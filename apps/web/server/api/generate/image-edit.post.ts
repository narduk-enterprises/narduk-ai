import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  sourceGenerationId: z.string().min(1),
})

/**
 * POST /api/generate/image-edit — Image-to-Image editing (I2I).
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

  log.info('AUDIT: I2I request', {
    action: 'generate_i2i',
    userId: user.id,
    sourceId: body.sourceGenerationId,
    promptLength: body.prompt.length,
  })

  const db = useDatabase(event)

  // Load source generation (must belong to user and be a completed image)
  const source = await db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.id, body.sourceGenerationId),
        eq(generations.userId, user.id),
        eq(generations.type, 'image'),
        eq(generations.status, 'done'),
      ),
    )
    .get()

  if (!source || !source.r2Key) {
    log.warn('I2I source not found', { userId: user.id, sourceId: body.sourceGenerationId })
    throw createError({ statusCode: 404, message: 'Source image not found' })
  }

  // Read source image from R2 and convert to base64 data URL
  const r2 = useR2(event)
  const r2Object = await r2.get(source.r2Key)
  if (!r2Object) {
    throw createError({ statusCode: 404, message: 'Source image not found in storage' })
  }

  const imageBytes = await r2Object.arrayBuffer()
  const bytes = new Uint8Array(imageBytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  const base64 = btoa(binary)
  const mimeType = r2Object.httpMetadata?.contentType || 'image/png'
  const dataUrl = `data:${mimeType};base64,${base64}`

  // Submit via batch API for cost savings
  const result = await grokBatchEditImage(config.xaiApiKey, {
    prompt: body.prompt,
    imageUrl: dataUrl,
  })

  log.info('I2I batch submitted', {
    userId: user.id,
    batchId: result.batchId,
    sourceId: body.sourceGenerationId,
  })

  // Insert pending generation record
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const record = {
    id,
    userId: user.id,
    type: 'image' as const,
    mode: 'i2i' as const,
    prompt: body.prompt,
    sourceGenerationId: body.sourceGenerationId,
    status: 'pending' as const,
    xaiRequestId: result.batchId,
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
