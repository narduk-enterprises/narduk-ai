import { eq } from 'drizzle-orm'
import { appSettings } from '#server/database/schema'
import { grokListModels } from '#server/utils/grok'
import { buildXaiModelCatalog } from '~/utils/xaiModels'

/**
 * GET /api/admin/settings — Retrieves the global application settings.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminSettings')
  const user = await requireAdmin(event)
  const config = useRuntimeConfig(event)

  const db = useDatabase(event)

  // There should only ever be one row (id=1).
  let settings = await db.select().from(appSettings).where(eq(appSettings.id, 1)).get()

  if (!settings) {
    // If somehow it wasn't seeded or created, insert the defaults dynamically.
    const now = new Date().toISOString()
    const defaultSettings = {
      id: 1,
      videoModel: 'grok-imagine-video',
      imageModel: 'grok-imagine-image',
      promptEnhanceModel: 'grok-3-mini',
      updatedAt: now,
    }

    if (config.xaiApiKey) {
      try {
        const catalog = buildXaiModelCatalog(
          (await grokListModels(config.xaiApiKey)).map((m) => m.id),
        )
        defaultSettings.videoModel = catalog.preferredVideoModel || defaultSettings.videoModel
        defaultSettings.imageModel = catalog.preferredImageModel || defaultSettings.imageModel
        defaultSettings.promptEnhanceModel =
          catalog.preferredChatModel || defaultSettings.promptEnhanceModel
      } catch (err) {
        log.warn('Could not resolve live xAI defaults for admin settings', { err })
      }
    }

    await db.insert(appSettings).values(defaultSettings).onConflictDoNothing()
    settings = defaultSettings
    log.info('Seeded default app actions dynamically', { userId: user.id })
  }

  return settings
})
