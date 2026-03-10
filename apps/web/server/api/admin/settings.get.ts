import { eq } from 'drizzle-orm'
import { appSettings } from '../../database/schema'

/**
 * GET /api/admin/settings — Retrieves the global application settings.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminSettings')
  const user = await requireAdmin(event)

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

    await db.insert(appSettings).values(defaultSettings).onConflictDoNothing()
    settings = defaultSettings
    log.info('Seeded default app actions dynamically', { userId: user.id })
  }

  return settings
})
