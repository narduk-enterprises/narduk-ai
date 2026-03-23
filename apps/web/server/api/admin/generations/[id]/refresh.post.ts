import { eq } from 'drizzle-orm'
import { generations } from '#server/database/schema'
import { defineAdminMutation } from '#layer/server/utils/mutation'

/**
 * POST /api/admin/generations/[id]/refresh — Force-check xAI status for a generation.
 * Admin-only. Polls xAI and updates D1 accordingly.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-generation-refresh', maxRequests: 20, windowMs: 60_000 },
  },
  async ({ event }) => {
    const log = useLogger(event).child('AdminGenerations')

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Missing generation ID' })

    const db = useAppDatabase(event)
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
            thumbnailUrl: result.video.coverImg ?? null,
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
        generationId: id,
        error: errorMsg,
      })

      // If it's an explicit 4xx error from xAI (e.g. 400 Bad Request, moderation fail, etc), we should mark it failed
      if (errorMsg.includes('40') && !errorMsg.includes('429')) {
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
  },
)
