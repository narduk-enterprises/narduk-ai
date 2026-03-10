import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { generations } from '../../database/schema'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const STALE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * GET /api/generations — List user's generations (newest first).
 * Supports ?limit=N&offset=N query params.
 * Proactively refreshes status for any pending video generations from xAI.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generations')
  const user = await requireAuth(event)
  const { limit, offset } = querySchema.parse(getQuery(event))

  const db = useDatabase(event)
  const config = useRuntimeConfig(event)

  const rows = await db
    .select()
    .from(generations)
    .where(eq(generations.userId, user.id))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset)

  // Refresh pending generations from xAI (both videos and batch images)
  const pendingGens = rows.filter(
    (r) => r.status === 'pending' && r.xaiRequestId && config.xaiApiKey,
  )

  if (pendingGens.length) {
    const now = new Date().toISOString()

    await Promise.all(
      // eslint-disable-next-line narduk/no-map-async-in-server -- xAI has no batch poll API; parallel per-generation calls are required
      pendingGens.map(async (gen) => {
        try {
          // Staleness check first
          const ageMs = Date.now() - new Date(gen.createdAt).getTime()
          if (ageMs > STALE_TIMEOUT_MS) {
            const errorMeta = JSON.stringify({
              error: {
                code: 'timeout',
                message:
                  'Generation timed out after 10 minutes. The API did not return a result in time.',
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

          // Route to batch or video polling based on generation type
          if (gen.type === 'image') {
            const result = await grokPollBatch(config.xaiApiKey, gen.xaiRequestId!)

            if (result.status === 'done' && result.imageUrl) {
              const r2Key = `generations/${user.id}/${gen.id}.png`
              const buffer = await downloadMedia(result.imageUrl)
              await uploadToR2(event, r2Key, buffer, 'image/png')

              await db
                .update(generations)
                .set({
                  status: 'done',
                  r2Key,
                  mediaUrl: `/api/media/${r2Key}`,
                  metadata: JSON.stringify({
                    revised_prompt: result.revisedPrompt,
                    estimatedCostUsd: estimateGenerationCost({ type: 'image' }),
                    batchApi: true,
                  }),
                  updatedAt: now,
                })
                .where(eq(generations.id, gen.id))
              gen.status = 'done'
              gen.r2Key = r2Key
              gen.mediaUrl = `/api/media/${r2Key}`
              gen.updatedAt = now
            } else if (result.status === 'failed') {
              const errorMeta = JSON.stringify({
                error: result.error || { code: 'unknown', message: 'Batch image generation failed' },
              })
              await db
                .update(generations)
                .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
                .where(eq(generations.id, gen.id))
              gen.status = 'failed'
              gen.metadata = errorMeta
              gen.updatedAt = now
            }
          } else {
            // Poll xAI video API
            const result = await grokPollVideo(config.xaiApiKey, gen.xaiRequestId!)

            if (result.status === 'done' && result.video?.url) {
              const r2Key = `generations/${user.id}/${gen.id}.mp4`
              const buffer = await downloadMedia(result.video.url)
              await uploadToR2(event, r2Key, buffer, 'video/mp4')

              await db
                .update(generations)
                .set({
                  status: 'done',
                  r2Key,
                  mediaUrl: `/api/media/${r2Key}`,
                  duration: result.video.duration,
                  metadata: JSON.stringify(result),
                  updatedAt: now,
                })
                .where(eq(generations.id, gen.id))
              gen.status = 'done'
              gen.r2Key = r2Key
              gen.mediaUrl = `/api/media/${r2Key}`
              gen.duration = result.video.duration
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
