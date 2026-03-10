import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  sourceGenerationId: z.string().min(1),
})

/**
 * POST /api/generate/image-edit — Image-to-Image editing (I2I).
 * Takes a source generation (must be an image owned by the user) and a prompt.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generate')
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('I2I request', {
    userId: user.id,
    sourceId: body.sourceGenerationId,
    promptLength: body.prompt.length,
  })

  const db = useDatabase(event)

  // Load source generation (must belong to user and be a completed image)
  const source = await db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.id, body.sourceGenerationId),
        eq(generations.userId, user.id),
        eq(generations.type, 'image'),
        eq(generations.status, 'done'),
      ),
    )
    .get()

  if (!source || !source.r2Key) {
    log.warn('I2I source not found', { userId: user.id, sourceId: body.sourceGenerationId })
    throw createError({ statusCode: 404, message: 'Source image not found' })
  }

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

  // Call Grok Image Edit API
  const result = await grokEditImage(config.xaiApiKey, {
    prompt: body.prompt,
    imageUrl: dataUrl,
  })

  const imageData = result.data?.[0]
  if (!imageData?.url) {
    log.error('I2I failed — no image returned', { userId: user.id })
    throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
  }

  // Download and store in R2
  const id = crypto.randomUUID()
  const r2Key = `generations/${user.id}/${id}.png`
  const buffer = await downloadMedia(imageData.url)
  await uploadToR2(event, r2Key, buffer, 'image/png')

  const now = new Date().toISOString()
  const record = {
    id,
    userId: user.id,
    type: 'image' as const,
    mode: 'i2i' as const,
    prompt: body.prompt,
    sourceGenerationId: body.sourceGenerationId,
    status: 'done' as const,
    r2Key,
    mediaUrl: `/api/media/${r2Key}`,
    metadata: JSON.stringify({ revised_prompt: imageData.revised_prompt }),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  log.info('I2I complete', { userId: user.id, generationId: id, sourceId: body.sourceGenerationId })

  return record
})
