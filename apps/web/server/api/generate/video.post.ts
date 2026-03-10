import { z } from 'zod'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  duration: z.number().int().min(1).max(15).optional().default(6),
  aspectRatio: z
    .enum(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
    .optional()
    .default('16:9'),
  resolution: z.enum(['480p', '720p']).optional().default('720p'),
})

/**
 * POST /api/generate/video — Text-to-Video generation (T2V).
 * Starts async video generation. Returns a pending generation record.
 * Client polls /api/generate/poll/[requestId] until done.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate', 10, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('T2V request', {
    userId: user.id,
    promptLength: body.prompt.length,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
  })

  // Start async video generation
  const result = await grokStartVideo(config.xaiApiKey, {
    prompt: body.prompt,
    duration: body.duration,
    aspect_ratio: body.aspectRatio,
    resolution: body.resolution,
  })

  log.info('T2V started', { userId: user.id, requestId: result.request_id })

  // Insert pending generation record
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const db = useDatabase(event)

  const record = {
    id,
    userId: user.id,
    type: 'video' as const,
    mode: 't2v' as const,
    prompt: body.prompt,
    status: 'pending' as const,
    xaiRequestId: result.request_id,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  return record
})
