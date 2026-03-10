import { z } from 'zod'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional(),
})

/**
 * POST /api/generate/image — Text-to-Image generation (T2I).
 * Uses the xAI batch API for ~50% cost savings.
 * Returns a pending record; client polls /api/generate/poll/[requestId].
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-image', 10, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('AUDIT: T2I request', {
    action: 'generate_t2i',
    userId: user.id,
    promptLength: body.prompt.length,
  })

  // Submit via batch API for cost savings
  const result = await grokBatchGenerateImage(config.xaiApiKey, {
    prompt: body.prompt,
    aspectRatio: body.aspectRatio,
  })

  log.info('T2I batch submitted', { userId: user.id, batchId: result.batchId })

  // Insert pending generation record
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const db = useDatabase(event)

  const record = {
    id,
    userId: user.id,
    type: 'image' as const,
    mode: 't2i' as const,
    prompt: body.prompt,
    status: 'pending' as const,
    xaiRequestId: result.batchId,
    aspectRatio: body.aspectRatio || null,
    metadata: JSON.stringify({
      estimatedCostUsd: estimateGenerationCost({ type: 'image' }),
      batchApi: true,
    }),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  return record
})
