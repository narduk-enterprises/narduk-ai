import { z } from 'zod'
import { appSettings } from '../../database/schema'

const bodySchema = z.object({
  videoModel: z.string().min(1),
  imageModel: z.string().min(1),
  promptEnhanceModel: z.string().min(1),
})

/**
 * PUT /api/admin/settings — Updates the global application settings.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminSettings')
  const user = await requireAdmin(event)

  await enforceRateLimit(event, 'admin-settings', 10, 60_000)

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase(event)
  const now = new Date().toISOString()

  // Upsert the single row (id=1)
  const result = await db
    .insert(appSettings)
    .values({
      id: 1,
      videoModel: body.videoModel,
      imageModel: body.imageModel,
      promptEnhanceModel: body.promptEnhanceModel,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        videoModel: body.videoModel,
        imageModel: body.imageModel,
        promptEnhanceModel: body.promptEnhanceModel,
        updatedAt: now,
      },
    })
    .returning()
    .get()

  log.info('App settings updated', {
    userId: user.id,
    videoModel: body.videoModel,
    imageModel: body.imageModel,
    promptEnhanceModel: body.promptEnhanceModel,
  })

  return result
})
