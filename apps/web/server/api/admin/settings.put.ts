import { z } from 'zod'
import { appSettings } from '#server/database/schema'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  videoModel: z.string().min(1),
  imageModel: z.string().min(1),
  promptEnhanceModel: z.string().min(1),
})

/**
 * PUT /api/admin/settings — Updates the global application settings.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-settings', maxRequests: 10, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, admin: user, body }) => {
    const log = useLogger(event).child('AdminSettings')
    const db = useAppDatabase(event)
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
  },
)
