import { desc } from 'drizzle-orm'
import { generations } from '../../../database/schema'

const STALE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * GET /api/admin/generations — List ALL generations across all users (admin only).
 * Returns generations with user email, status diagnostics, and age info.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminGenerations')
  await requireAdmin(event)

  const db = useDatabase(event)
  const config = useRuntimeConfig(event)

  const rows = await db.select().from(generations).orderBy(desc(generations.createdAt)).limit(200)

  // Enrich with diagnostic info
  const enriched = rows.map((gen) => {
    const ageMs = Date.now() - new Date(gen.createdAt).getTime()
    const ageMinutes = Math.round(ageMs / 60000)
    const isStale = gen.status === 'pending' && ageMs > STALE_TIMEOUT_MS

    let errorInfo: string | null = null
    if (gen.metadata) {
      try {
        const meta = JSON.parse(gen.metadata)
        if (meta.error?.message) errorInfo = meta.error.message
        else if (typeof meta.error === 'string') errorInfo = meta.error
      } catch {
        // ignore parse errors
      }
    }

    return {
      ...gen,
      ageMinutes,
      isStale,
      errorInfo,
      hasApiKey: !!config.xaiApiKey,
    }
  })

  log.info('Admin listed generations', { count: enriched.length })

  return enriched
})
