import { eq, and } from 'drizzle-orm'
import { generations } from '../../../database/schema'

/**
 * GET /api/generate/poll/[requestId] — Poll video generation status.
 * When done, downloads the video to R2 and updates the D1 record.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  const requestId = getRouterParam(event, 'requestId')

  if (!requestId) {
    throw createError({ statusCode: 400, message: 'Missing requestId' })
  }

  const config = useRuntimeConfig(event)
  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const db = useDatabase(event)

  // Find the pending generation record owned by this user
  const gen = await db
    .select()
    .from(generations)
    .where(and(eq(generations.xaiRequestId, requestId), eq(generations.userId, user.id)))
    .get()

  if (!gen) {
    throw createError({ statusCode: 404, message: 'Generation not found' })
  }

  // If already done or failed, return current state
  if (gen.status === 'done' || gen.status === 'failed' || gen.status === 'expired') {
    log.debug('Poll — already terminal', { generationId: gen.id, status: gen.status })
    return gen
  }

  // Staleness check — auto-fail generations pending for >10 minutes
  const ageMs = Date.now() - new Date(gen.createdAt).getTime()
  if (ageMs > GENERATION_STALE_TIMEOUT_MS) {
    const now = new Date().toISOString()
    const errorMeta = JSON.stringify({
      error: {
        code: 'timeout',
        message: 'Generation timed out after 10 minutes. The API did not return a result in time.',
      },
    })
    await db
      .update(generations)
      .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
      .where(eq(generations.id, gen.id))

    log.warn('Poll — generation timed out', {
      generationId: gen.id,
      requestId,
      ageMinutes: Math.round(ageMs / 60000),
    })

    return { ...gen, status: 'failed', metadata: errorMeta }
  }

  // Poll Grok API
  const result = await grokPollVideo(config.xaiApiKey, requestId)

  log.info('Poll result', { generationId: gen.id, requestId, status: result.status })

  if (result.status === 'done' && result.video?.url) {
    // Download video and store in R2 synchronously to prevent 404 race condition
    const r2Key = `generations/${user.id}/${gen.id}.mp4`
    try {
      const buffer = await downloadMedia(result.video!.url)
      await uploadToR2(event, r2Key, buffer, 'video/mp4')
    } catch (err) {
      log.error('R2 upload failed', { userId: user.id, generationId: gen.id, err })
      const now = new Date().toISOString()
      const errorMeta = JSON.stringify({
        error: { message: 'Failed to save generated video to storage' },
      })
      await db
        .update(generations)
        .set({
          status: 'failed',
          metadata: errorMeta,
          updatedAt: now,
        })
        .where(eq(generations.id, gen.id))
      return { ...gen, status: 'failed' as const, metadata: errorMeta }
    }

    const now = new Date().toISOString()
    const generationTimeMs = Date.now() - new Date(gen.createdAt).getTime()
    await db
      .update(generations)
      .set({
        status: 'done',
        r2Key,
        mediaUrl: `/api/media/${r2Key}`,
        thumbnailUrl: result.video.coverImg,
        duration: result.video.duration,
        generationTimeMs,
        metadata: JSON.stringify(result),
        updatedAt: now,
      })
      .where(eq(generations.id, gen.id))

    log.info('Poll — video ready, stored to R2', {
      generationId: gen.id,
      r2Key,
      duration: result.video.duration,
    })

    return {
      ...gen,
      status: 'done',
      r2Key,
      mediaUrl: `/api/media/${r2Key}`,
      duration: result.video.duration,
      generationTimeMs,
    }
  }

  if (result.status === 'expired') {
    const now = new Date().toISOString()
    await db
      .update(generations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(generations.id, gen.id))

    log.warn('Poll — video expired', { generationId: gen.id, requestId })

    return { ...gen, status: 'expired' }
  }

  if (result.status === 'failed') {
    const now = new Date().toISOString()
    await db
      .update(generations)
      .set({
        status: 'failed',
        metadata: JSON.stringify({
          error: result.error || { code: 'unknown', message: 'Video generation failed' },
        }),
        updatedAt: now,
      })
      .where(eq(generations.id, gen.id))

    log.error('Poll — video failed', {
      generationId: gen.id,
      requestId,
      error: result.error,
    })

    return {
      ...gen,
      status: 'failed',
      metadata: JSON.stringify({
        error: result.error || { code: 'unknown', message: 'Video generation failed' },
      }),
    }
  }

  // Still pending
  return { ...gen, status: 'pending' }
})
