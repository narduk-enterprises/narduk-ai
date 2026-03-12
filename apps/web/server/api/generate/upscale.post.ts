import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { generations, appSettings } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import { createGenerationComparisonDefaults } from '#server/utils/imageComparisons'

const bodySchema = z.object({
  generationId: z.string().min(1),
})

/**
 * POST /api/generate/upscale — Upscale an existing image to 2K resolution.
 * Sends the image back through the Grok edit API with resolution: "2k".
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

  const db = useAppDatabase(event)

  // Load source generation (must belong to user and be a completed image)
  const source = await db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.id, body.generationId),
        eq(generations.userId, user.id),
        eq(generations.type, 'image'),
        eq(generations.status, 'done'),
      ),
    )
    .get()

  if (!source || !source.r2Key) {
    throw createError({ statusCode: 404, message: 'Source image not found' })
  }

  log.info('AUDIT: Upscale request', {
    action: 'generate_upscale',
    userId: user.id,
    sourceId: body.generationId,
  })

  // Read source image from R2 and convert to base64 data URL
  const r2 = useR2(event)
  const r2Object = await r2.get(source.r2Key)
  if (!r2Object) {
    throw createError({ statusCode: 404, message: 'Source image not found in storage' })
  }

  const imageBytes = await r2Object.arrayBuffer()
  const bytes = new Uint8Array(imageBytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  const base64 = btoa(binary)
  const mimeType = r2Object.httpMetadata?.contentType || 'image/png'
  const dataUrl = `data:${mimeType};base64,${base64}`

  // Fetch configured model
  let imageModel = 'grok-imagine-image'
  try {
    const settings = await db
      .select({ imageModel: appSettings.imageModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()
    if (settings?.imageModel) {
      imageModel = settings.imageModel
    }
  } catch (err) {
    log.warn('Could not fetch appSettings for imageModel', { err })
  }

  // Call Grok Image Edit API with 2K resolution
  const startTimeMs = Date.now()
  const result = await grokEditImage(config.xaiApiKey, {
    prompt: source.prompt || 'Enhance this image with higher resolution and sharper details.',
    model: imageModel,
    imageUrl: dataUrl,
    resolution: '2k',
  })
  const generationTimeMs = Date.now() - startTimeMs

  const imageData = result.data?.[0]
  const imageUrl = imageData?.url
  if (!imageUrl) {
    log.error('Upscale failed — no image returned', { userId: user.id })
    throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
  }

  // Download and store in R2
  const id = crypto.randomUUID()
  const r2Key = `generations/${user.id}/${id}.png`
  try {
    const buffer = await downloadMedia(imageUrl)
    await uploadToR2(event, r2Key, buffer, 'image/png')
  } catch (err) {
    log.error('R2 upload failed', { userId: user.id, generationId: id, err })
    throw createError({ statusCode: 500, message: 'Failed to save upscaled image' })
  }

  const now = new Date().toISOString()
  const record = {
    id,
    userId: user.id,
    type: 'image' as const,
    mode: 'i2i' as const,
    prompt: `[Upscaled 2K] ${source.prompt || ''}`,
    sourceGenerationId: body.generationId,
    status: 'done' as const,
    r2Key,
    mediaUrl: `/api/media/${r2Key}`,
    ...createGenerationComparisonDefaults(),
    metadata: JSON.stringify({
      revised_prompt: imageData.revised_prompt,
      upscaled: true,
      resolution: '2k',
    }),
    generationTimeMs,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  log.info('Upscale complete', {
    userId: user.id,
    generationId: id,
    sourceId: body.generationId,
  })

  return record
})
