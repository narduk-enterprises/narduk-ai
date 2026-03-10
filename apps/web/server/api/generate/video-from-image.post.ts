import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  sourceGenerationId: z.string().min(1),
  duration: z.number().int().min(1).max(15).optional().default(6),
  resolution: z.enum(['480p', '720p']).optional().default('720p'),
})

/**
 * POST /api/generate/video-from-image — Image-to-Video generation (I2V).
 * Takes a source image from the user's gallery and produces a video.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('I2V request', {
    userId: user.id,
    sourceId: body.sourceGenerationId,
    promptLength: body.prompt.length,
    duration: body.duration,
    resolution: body.resolution,
  })

  const db = useDatabase(event)

  // Load source image (must belong to user and be a completed image)
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
    log.warn('I2V source not found', { userId: user.id, sourceId: body.sourceGenerationId })
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

  // Start async video generation with source image
  const result = await grokStartVideo(config.xaiApiKey, {
    prompt: body.prompt,
    duration: body.duration,
    resolution: body.resolution,
    image: { url: dataUrl },
  })

  log.info('I2V started', {
    userId: user.id,
    requestId: result.request_id,
    sourceId: body.sourceGenerationId,
  })

  // Insert pending generation record
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const record = {
    id,
    userId: user.id,
    type: 'video' as const,
    mode: 'i2v' as const,
    prompt: body.prompt,
    sourceGenerationId: body.sourceGenerationId,
    status: 'pending' as const,
    xaiRequestId: result.request_id,
    duration: body.duration,
    resolution: body.resolution,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  return record
})
