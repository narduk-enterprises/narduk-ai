import { z } from 'zod'
import { MAX_GENERATION_PROMPT_LENGTH } from '~/utils/promptLimits'
import { generateStoredImages } from '#server/utils/imageGeneration'

const requestSchema = z.object({
  prompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  aspectRatio: z.string().optional(),
  model: z.string().optional(),
  promptElements: z.array(z.string()).optional(),
  presets: z.record(z.string(), z.string()).optional(),
  userPromptId: z.string().optional(),
  lineage: z.string().max(500_000).optional(),
  count: z.number().int().min(1).max(10).optional(),
})

const bodySchema = z.object({
  requests: z.array(requestSchema).min(1).max(100),
})

function isConcurrentLimitError(err: unknown) {
  if (!(err instanceof Error)) return false
  return err.message.toLowerCase().includes('too many concurrent requests')
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST /api/generate/image-batch — xAI image batch orchestration.
 *
 * Matches xAI guidance:
 * - same prompt variations should use `n`
 * - different prompts can run concurrently up to the team's console limit
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('GenerateBatch')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-image-batch', 12, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  const maxConcurrent = Math.max(
    1,
    Math.min(20, Number(config.xaiImportedImageMaxConcurrent || 10)),
  )
  const maxRetries = Math.max(1, Math.min(5, Number(config.xaiImportedImageMaxRetries || 3)))
  const retryDelayMs = Math.max(250, Number(config.xaiImportedImageRetryDelayMs || 1500))

  const groupedRequests = new Map<
    string,
    z.infer<typeof requestSchema> & {
      count: number
    }
  >()

  for (const request of body.requests) {
    const key = JSON.stringify([
      request.prompt,
      request.aspectRatio || '',
      request.model || '',
      request.userPromptId || '',
      request.lineage || '',
      JSON.stringify(request.promptElements || []),
      JSON.stringify(request.presets || {}),
    ])
    const existing = groupedRequests.get(key)
    if (existing) {
      existing.count = Math.min(10, existing.count + (request.count || 1))
    } else {
      groupedRequests.set(key, {
        ...request,
        count: request.count || 1,
      })
    }
  }

  const queue = Array.from(groupedRequests.values())
  const results: Awaited<ReturnType<typeof generateStoredImages>> = []
  let failures = 0
  let nextIndex = 0

  log.info('AUDIT: T2I batch request', {
    action: 'generate_t2i_batch',
    userId: user.id,
    requestCount: queue.reduce((sum, request) => sum + request.count, 0),
    groupedRequestCount: queue.length,
    maxConcurrent,
  })

  const worker = async () => {
    while (nextIndex < queue.length) {
      const currentIndex = nextIndex
      nextIndex++
      const request = queue[currentIndex]
      if (!request) return

      let attempt = 0
      let completed = false

      while (attempt < maxRetries && !completed) {
        attempt++
        try {
          const stored = await generateStoredImages(
            event,
            {
              userId: user.id,
              prompt: request.prompt,
              aspectRatio: request.aspectRatio,
              model: request.model,
              promptElements: request.promptElements,
              presets: request.presets,
              userPromptId: request.userPromptId,
              lineage: request.lineage,
              n: request.count,
            },
            log,
          )
          results.push(...stored)
          completed = true
        } catch (err) {
          if (!isConcurrentLimitError(err) || attempt >= maxRetries) {
            failures += request.count
            completed = true
            continue
          }

          await sleep(retryDelayMs * attempt)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, queue.length) }, () => worker()))

  return {
    results,
    failures,
  }
})
