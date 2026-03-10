import { eq } from 'drizzle-orm'
import { generations } from '../../database/schema'

const STALE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

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

  const jobsWithRequestId = pendingRows.filter((row) => row.xaiRequestId)
  if (!jobsWithRequestId.length) {
    return { status: 'ok', message: 'No pending jobs to sync' }
  }

  log.info(`Syncing ${jobsWithRequestId.length} pending jobs`)
  const now = new Date().toISOString()
  let synced = 0
  let failed = 0

  await Promise.all(
    // eslint-disable-next-line narduk/no-map-async-in-server -- xAI has no batch poll API; parallel per-generation calls are required
    pendingRows.map(async (gen) => {
      try {
        const ageMs = Date.now() - new Date(gen.createdAt).getTime()
        if (ageMs > STALE_TIMEOUT_MS) {
          const errorMeta = JSON.stringify({
            error: {
              code: 'timeout',
              message: 'Generation timed out after 10 minutes.',
            },
          })
          await db
            .update(generations)
            .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
            .where(eq(generations.id, gen.id))
          failed++
          return
        }

        if (!gen.xaiRequestId) return

        // Route to appropriate polling function based on generation type
        if (gen.type === 'image') {
          await syncBatchImage(gen, db, config.xaiApiKey, log, event, now)
        } else {
          await syncVideo(gen, db, config.xaiApiKey, log, event, now)
        }
        synced++
      } catch (err) {
        log.warn('Failed to sync pending generation', {
          generationId: gen.id,
          error: err instanceof Error ? err.message : String(err),
        })
        const errorMsg = err instanceof Error ? err.message : String(err)
        // Persist 4xx errors as failed state
        if (errorMsg.includes('40') && !errorMsg.includes('429')) {
          const errorMeta = JSON.stringify({
            error: { code: 'xai_error', message: errorMsg },
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

  return { status: 'ok', synced, failed, total: jobsWithRequestId.length }
})

// ─── Helper: sync batch image generation ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBatchImage(gen: any, db: any, apiKey: string, log: any, event: any, now: string) {
  const result = await grokPollBatch(apiKey, gen.xaiRequestId!)

  if (result.status === 'done' && result.imageUrl) {
    const r2Key = `generations/${gen.userId}/${gen.id}.png`
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
  } else if (result.status === 'failed') {
    const errorMeta = JSON.stringify({
      error: result.error || { code: 'unknown', message: 'Batch image generation failed' },
    })
    await db
      .update(generations)
      .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
      .where(eq(generations.id, gen.id))
  }
}

// ─── Helper: sync video generation ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncVideo(gen: any, db: any, apiKey: string, log: any, event: any, now: string) {
  const result = await grokPollVideo(apiKey, gen.xaiRequestId!)

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
        thumbnailUrl: result.video.coverImg,
        duration: result.video.duration,
        metadata: JSON.stringify(result),
        updatedAt: now,
      })
      .where(eq(generations.id, gen.id))
  } else if (result.status === 'failed') {
    const errorMeta = JSON.stringify({
      error: result.error || { code: 'unknown', message: 'Video generation failed' },
    })
    await db
      .update(generations)
      .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
      .where(eq(generations.id, gen.id))
  } else if (result.status === 'expired') {
    await db
      .update(generations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(generations.id, gen.id))
  }
}
