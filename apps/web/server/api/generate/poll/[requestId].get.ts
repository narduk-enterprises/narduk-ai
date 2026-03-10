import { eq, and } from 'drizzle-orm'
import { generations } from '../../../database/schema'

/**
 * GET /api/generate/poll/[requestId] — Poll generation status (video or batch image).
 * When done, downloads the media to R2 and updates the D1 record.
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

  // Determine if this is a batch image or video poll
  const isBatchImage = gen.type === 'image'

  if (isBatchImage) {
    return await pollBatchImage(event, log, gen, requestId, config.xaiApiKey, db)
  }

  return await pollVideo(event, log, gen, requestId, config.xaiApiKey, db)
})

/**
 * Poll a batch image generation via the xAI batch API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pollBatchImage(event: any, log: any, gen: any, batchId: string, apiKey: string, db: any) {
  const result = await grokPollBatch(apiKey, batchId)

  log.info('Batch poll result', { generationId: gen.id, batchId, status: result.status })

  if (result.status === 'done' && result.imageUrl) {
    // Download image and store in R2 in the background
    const r2Key = `generations/${gen.userId}/${gen.id}.png`
    event.waitUntil(
      (async () => {
        try {
          const buffer = await downloadMedia(result.imageUrl!)
          await uploadToR2(event, r2Key, buffer, 'image/png')
        } catch (err) {
          log.error('Background R2 upload failed', { userId: gen.userId, generationId: gen.id, err })
        }
      })(),
    )

    const now = new Date().toISOString()
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

    log.info('Batch — image ready, stored to R2', { generationId: gen.id, r2Key })

    return {
      ...gen,
      status: 'done',
      r2Key,
      mediaUrl: `/api/media/${r2Key}`,
    }
  }

  if (result.status === 'failed') {
    const now = new Date().toISOString()
    await db
      .update(generations)
      .set({
        status: 'failed',
        metadata: JSON.stringify({
          error: result.error || { code: 'unknown', message: 'Batch image generation failed' },
        }),
        updatedAt: now,
      })
      .where(eq(generations.id, gen.id))

    log.error('Batch — image failed', { generationId: gen.id, batchId, error: result.error })

    return {
      ...gen,
      status: 'failed',
      metadata: JSON.stringify({
        error: result.error || { code: 'unknown', message: 'Batch image generation failed' },
      }),
    }
  }

  // Still pending
  return { ...gen, status: 'pending' }
}

/**
 * Poll a video generation via the xAI video API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pollVideo(event: any, log: any, gen: any, requestId: string, apiKey: string, db: any) {
  const result = await grokPollVideo(apiKey, requestId)

  log.info('Poll result', { generationId: gen.id, requestId, status: result.status })

  if (result.status === 'done' && result.video?.url) {
    // Download video and store in R2 in the background
    const r2Key = `generations/${gen.userId}/${gen.id}.mp4`
    event.waitUntil(
      (async () => {
        try {
          const buffer = await downloadMedia(result.video!.url)
          await uploadToR2(event, r2Key, buffer, 'video/mp4')
        } catch (err) {
          log.error('Background R2 upload failed', { userId: gen.userId, generationId: gen.id, err })
        }
      })(),
    )

    const now = new Date().toISOString()
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
}
