import { eq } from 'drizzle-orm'
import type { H3Error } from 'h3'
import { generations } from '../../../../database/schema'

/**
 * POST /api/admin/generations/[id]/refresh — Force-check xAI status for a generation.
 * Admin-only. Polls xAI and updates D1 accordingly.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminGenerations')
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing generation ID' })

  const db = useDatabase(event)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const gen = await db.select().from(generations).where(eq(generations.id, id)).get()
  if (!gen) throw createError({ statusCode: 404, message: 'Generation not found' })

  if (!gen.xaiRequestId) {
    return { ...gen, refreshResult: 'no_request_id', message: 'No xAI request ID to poll' }
  }

  // Force poll xAI regardless of current status
  try {
    const result = await grokPollVideo(config.xaiApiKey, gen.xaiRequestId)
    const now = new Date().toISOString()

    log.info('Admin force-refresh', {
      adminId: admin.id,
      generationId: id,
      xaiRequestId: gen.xaiRequestId,
      xaiStatus: result.status,
    })

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

      const updated = await db.select().from(generations).where(eq(generations.id, id)).get()
      return { ...updated, refreshResult: 'completed', xaiResponse: result }
    }

    if (result.status === 'failed') {
      const errorMeta = JSON.stringify({
        error: result.error || { code: 'unknown', message: 'Video generation failed' },
      })
      await db
        .update(generations)
        .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
        .where(eq(generations.id, gen.id))

      const updated = await db.select().from(generations).where(eq(generations.id, id)).get()
      return { ...updated, refreshResult: 'failed', xaiResponse: result }
    }

    if (result.status === 'expired') {
      await db
        .update(generations)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(generations.id, gen.id))

      const updated = await db.select().from(generations).where(eq(generations.id, id)).get()
      return { ...updated, refreshResult: 'expired', xaiResponse: result }
    }

    // Still pending at xAI
    return { ...gen, refreshResult: 'still_pending', xaiResponse: result }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    log.error('Admin refresh failed', {
      adminId: admin.id,
      generationId: id,
      error: errorMsg,
    })

    // Persist 4xx errors (except 429 rate-limit) as permanently failed
    const statusCode = (err as H3Error).statusCode ?? 0
    const is4xxError =
      typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429
    if (is4xxError) {
      const now = new Date().toISOString()
      const errorMeta = JSON.stringify({
        error: { code: 'xai_error', message: errorMsg },
      })
      await db
        .update(generations)
        .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
        .where(eq(generations.id, gen.id))

      const updated = await db.select().from(generations).where(eq(generations.id, id)).get()
      return { ...updated, refreshResult: 'failed_by_error', message: errorMsg }
    }

    return {
      ...gen,
      refreshResult: 'error',
      message: errorMsg,
    }
  }
})
