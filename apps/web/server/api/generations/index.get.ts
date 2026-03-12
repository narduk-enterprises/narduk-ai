import { z } from 'zod'
import { eq, desc, like, and, or, gt } from 'drizzle-orm'
import { generations } from '../../database/schema'
import { GENERATION_STALE_TIMEOUT_MS } from '../../utils/constants'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  type: z.enum(['image', 'video']).optional(),
  mode: z.string().optional(),
  /** ISO timestamp — return only rows created after this value (for live polling). */
  since: z.string().datetime({ offset: true }).optional(),
})

/**
 * GET /api/generations — List user's generations (newest first).
 * Supports ?limit=N&offset=N&type=image|video&mode=t2i|t2v|i2v|i2i query params.
 * Proactively refreshes status for any pending video generations from xAI.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generations')
  const user = await requireAuth(event)
  const { limit, offset, search, type, mode, since } = querySchema.parse(getQuery(event))

  const db = useDatabase(event)
  const config = useRuntimeConfig(event)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle dynamic query filter array avoids tricky SQL conditional typings
  const filters: any[] = [eq(generations.userId, user.id)]

  if (search && search.trim()) {
    filters.push(
      or(
        like(generations.prompt, `%${search.trim()}%`),
        like(generations.presets, `%${search.trim()}%`),
      ),
    )
  }
  if (type) {
    filters.push(eq(generations.type, type))
  }
  if (mode) {
    filters.push(eq(generations.mode, mode))
  }
  if (since) {
    filters.push(gt(generations.createdAt, since))
  }

  const baseQuery = db
    .select()
    .from(generations)
    .where(and(...filters))

  // When polling with `since`, skip pagination — always return newest delta
  const rows = since
    ? await baseQuery.orderBy(desc(generations.createdAt)).limit(100)
    : await baseQuery.orderBy(desc(generations.createdAt)).limit(limit).offset(offset)

  // Refresh pending video generations from xAI
  const pendingVideos = rows.filter(
    (r) => r.status === 'pending' && r.xaiRequestId && config.xaiApiKey,
  )

  if (pendingVideos.length) {
    const now = new Date().toISOString()

    await Promise.all(
      // eslint-disable-next-line narduk/no-map-async-in-server -- xAI has no batch poll API; parallel per-generation calls are required
      pendingVideos.map(async (gen) => {
        try {
          // Staleness check first
          const ageMs = Date.now() - new Date(gen.createdAt).getTime()
          if (ageMs > GENERATION_STALE_TIMEOUT_MS) {
            const errorMeta = JSON.stringify({
              error: {
                code: 'timeout',
                message:
                  'Generation timed out after 5 minutes. The API did not return a result in time.',
              },
            })
            await db
              .update(generations)
              .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
              .where(eq(generations.id, gen.id))
            gen.status = 'failed'
            gen.metadata = errorMeta
            gen.updatedAt = now
            return
          }

          // Poll xAI for current status
          const result = await grokPollVideo(config.xaiApiKey, gen.xaiRequestId!)

          if (result.status === 'done' && result.video?.url) {
            const r2Key = `generations/${user.id}/${gen.id}.mp4`
            const buffer = await downloadMedia(result.video.url)
            await uploadToR2(event, r2Key, buffer, 'video/mp4')

            const generationTimeMs = Date.now() - new Date(gen.createdAt).getTime()
            await db
              .update(generations)
              .set({
                status: 'done',
                r2Key,
                mediaUrl: `/api/media/${r2Key}`,
                duration: result.video.duration,
                generationTimeMs,
                metadata: JSON.stringify(result),
                updatedAt: now,
              })
              .where(eq(generations.id, gen.id))
            gen.status = 'done'
            gen.r2Key = r2Key
            gen.mediaUrl = `/api/media/${r2Key}`
            gen.duration = result.video.duration
            gen.generationTimeMs = generationTimeMs
            gen.metadata = JSON.stringify(result)
            gen.updatedAt = now
          } else if (result.status === 'failed') {
            const errorMeta = JSON.stringify({
              error: result.error || { code: 'unknown', message: 'Video generation failed' },
            })
            await db
              .update(generations)
              .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
              .where(eq(generations.id, gen.id))
            gen.status = 'failed'
            gen.metadata = errorMeta
            gen.updatedAt = now
          } else if (result.status === 'expired') {
            await db
              .update(generations)
              .set({ status: 'expired', updatedAt: now })
              .where(eq(generations.id, gen.id))
            gen.status = 'expired'
            gen.updatedAt = now
          }
        } catch (err) {
          log.warn('Failed to refresh pending generation', {
            generationId: gen.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )
  }

  log.debug('Generations listed', { userId: user.id, count: rows.length, limit, offset })

  return rows
})
