import { z } from 'zod'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional(),
})

/**
 * POST /api/generate/image — Text-to-Image generation.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-image', 10, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('AUDIT: T2I request', {
    action: 'generate_t2i',
    userId: user.id,
    promptLength: body.prompt.length,
  })

  // Call Grok Imagine API
  const result = await grokGenerateImage(config.xaiApiKey, {
    prompt: body.prompt,
    aspectRatio: body.aspectRatio,
  })

  const imageData = result.data?.[0]
  const imageUrl = imageData?.url
  if (!imageUrl) {
    log.error('T2I failed — no image returned', { userId: user.id })
    throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
  }

  // Download and store in R2 in the background
  const id = crypto.randomUUID()
  const r2Key = `generations/${user.id}/${id}.png`
  event.waitUntil(
    (async () => {
      try {
        const buffer = await downloadMedia(imageUrl)
        await uploadToR2(event, r2Key, buffer, 'image/png')
      } catch (err) {
        log.error('Background R2 upload failed', { userId: user.id, generationId: id, err })
      }
    })(),
  )

  // Insert generation record
  const now = new Date().toISOString()
  const db = useDatabase(event)
  const record = {
    id,
    userId: user.id,
    type: 'image' as const,
    mode: 't2i' as const,
    prompt: body.prompt,
    status: 'done' as const,
    r2Key,
    mediaUrl: `/api/media/${r2Key}`,
    aspectRatio: body.aspectRatio || null,
    metadata: JSON.stringify({
      revised_prompt: imageData.revised_prompt,
      estimatedCostUsd: estimateGenerationCost({ type: 'image' }),
    }),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  log.info('T2I complete', { userId: user.id, generationId: id })

  return record
})
