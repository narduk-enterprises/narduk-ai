import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
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
 * Runs one xAI image request per prompt using a bounded worker pool.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'generate-image-batch', maxRequests: 12, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const log = useLogger(event).child('GenerateBatch')
    const config = useRuntimeConfig(event)

    const maxConcurrent = Math.max(
      1,
      Math.min(20, Number(config.xaiImportedImageMaxConcurrent || 10)),
    )
    const maxRetries = Math.max(1, Math.min(5, Number(config.xaiImportedImageMaxRetries || 3)))
    const retryDelayMs = Math.max(250, Number(config.xaiImportedImageRetryDelayMs || 1500))

    const queue = body.requests
    const orderedResults = new Array<
      Awaited<ReturnType<typeof generateStoredImages>>[number] | null
    >(queue.length).fill(null)
    let failures = 0
    let nextIndex = 0

    log.info('AUDIT: T2I batch request', {
      action: 'generate_t2i_batch',
      userId: user.id,
      requestCount: queue.length,
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
                n: 1,
              },
              log,
            )
            orderedResults[currentIndex] = stored[0] || null
            completed = true
          } catch (err) {
            if (!isConcurrentLimitError(err) || attempt >= maxRetries) {
              failures++
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
      results: orderedResults.filter(
        (result): result is NonNullable<(typeof orderedResults)[number]> => result !== null,
      ),
      failures,
    }
  },
)
