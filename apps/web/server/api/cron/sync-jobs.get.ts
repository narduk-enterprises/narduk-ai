import { eq } from 'drizzle-orm'
import type { H3Error } from 'h3'
import { generations } from '../../database/schema'

/**
 * GET /api/cron/sync-jobs
 * Checks pending job statuses via xAI API and marks failed or completed jobs.
 * Exposed for scheduled cron triggers. Must pass valid CRON_SECRET if configured.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('CronSync')
  const config = useRuntimeConfig(event)

  // Auth: standard template behavior checks process.env.CRON_SECRET
  if (config.cronSecret) {
    const authHeader = getHeader(event, 'Authorization')
    if (authHeader !== `Bearer ${config.cronSecret}`) {
      throw createError({ statusCode: 401, message: 'Unauthorized cron runner' })
    }
  }

  if (!config.xaiApiKey) {
    log.error('No xAI API key configured for sync-jobs cron')
    return { status: 'error', message: 'No xAI API key' }
  }

  const db = useDatabase(event)
  const pendingRows = await db.select().from(generations).where(eq(generations.status, 'pending'))

  const videoJobs = pendingRows.filter((row) => row.xaiRequestId)
  if (!videoJobs.length) {
    return { status: 'ok', message: 'No pending video jobs to sync' }
  }

  log.info(`Syncing ${videoJobs.length} pending video jobs`)
  const now = new Date().toISOString()
  let synced = 0
  let failed = 0

  await Promise.all(
    // eslint-disable-next-line narduk/no-map-async-in-server -- xAI has no batch poll API
    videoJobs.map(async (gen) => {
      try {
        if (isGenerationStale(gen.createdAt)) {
          await db
            .update(generations)
            .set({ status: 'failed', metadata: TIMEOUT_ERROR_META, updatedAt: now })
            .where(eq(generations.id, gen.id))
          failed++
          return
        }

        const result = await grokPollVideo(config.xaiApiKey, gen.xaiRequestId!)

        if (result.status === 'done' && result.video?.url) {
          const r2Key = `generations/${gen.userId}/${gen.id}.mp4`
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
          synced++
        } else if (result.status === 'failed') {
          const errorMeta = JSON.stringify({
            error: result.error || { code: 'unknown', message: 'Video generation failed' },
          })
          await db
            .update(generations)
            .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
            .where(eq(generations.id, gen.id))
          synced++
        } else if (result.status === 'expired') {
          await db
            .update(generations)
            .set({ status: 'expired', updatedAt: now })
            .where(eq(generations.id, gen.id))
          synced++
        }
      } catch (err) {
        log.warn('Failed to sync pending generation', {
          generationId: gen.id,
          error: err instanceof Error ? err.message : String(err),
        })
        // Persist 4xx errors (except 429 rate-limit) as permanently failed
        const statusCode = (err as H3Error).statusCode ?? 0
        const is4xxError =
          typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429
        if (is4xxError) {
          const errorMeta = JSON.stringify({
            error: {
              code: 'xai_error',
              message: err instanceof Error ? err.message : String(err),
            },
          })
          await db
            .update(generations)
            .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
            .where(eq(generations.id, gen.id))
          failed++
        }
      }
    }),
  )

  return { status: 'ok', synced, failed, total: videoJobs.length }
})
