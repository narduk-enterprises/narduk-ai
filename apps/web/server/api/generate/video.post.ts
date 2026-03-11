import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { generations, appSettings } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(20_000),

  duration: z.number().int().min(1).max(15).optional().default(6),
  aspectRatio: z
    .enum(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
    .optional()
    .default('16:9'),
  resolution: z.enum(['480p', '720p']).optional().default('720p'),
  promptElements: z.array(z.string()).optional(),
  presets: z.record(z.string(), z.string()).optional(),
  userPromptId: z.string().optional(),
  lineage: z.string().max(50000).optional(),
})

/**
 * POST /api/generate/video — Text-to-Video generation (T2V).
 * Starts async video generation. Returns a pending generation record.
 * Client polls /api/generate/poll/[requestId] until done.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-video', 5, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('AUDIT: T2V request', {
    action: 'generate_t2v',
    userId: user.id,
    promptLength: body.prompt.length,
    duration: body.duration,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
  })

  const db = useDatabase(event)

  // Fetch configured model from database
  let videoModel = 'grok-imagine-video'
  try {
    const settings = await db
      .select({ videoModel: appSettings.videoModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()
    if (settings?.videoModel) {
      videoModel = settings.videoModel
    }
  } catch (err) {
    log.warn('Could not fetch appSettings for videoModel', { err })
  }

  // Start async video generation
  const result = await grokStartVideo(config.xaiApiKey, {
    prompt: body.prompt,
    model: videoModel,
    duration: body.duration,
    aspect_ratio: body.aspectRatio,
    resolution: body.resolution,
  })

  log.info('T2V started', { userId: user.id, requestId: result.request_id })

  // Insert pending generation record
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

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
    promptElements: body.promptElements ? JSON.stringify(body.promptElements) : null,
    presets: body.presets ? JSON.stringify(body.presets) : null,
    lineage: body.lineage || null,
    userPromptId: body.userPromptId || null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  return record
})
