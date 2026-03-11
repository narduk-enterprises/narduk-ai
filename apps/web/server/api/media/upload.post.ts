import { z } from 'zod'
import { generations } from '../../database/schema'

const bodySchema = z.object({
  imageBase64: z.string().min(1),
})

/**
 * POST /api/media/upload
 *
 * Uploads an image (via base64) to R2 and creates a spoofed 'generation' record
 * so that it seamlessly integrates with the rest of the generation gallery
 * and I2I workflows.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('MediaUpload')
  const user = await requireAuth(event)

  // Rate limit uploads to prevent spam (e.g. 5 uploads per minute)
  await enforceRateLimit(event, 'media-upload', 5, 60_000)

  const body = await readValidatedBody(event, bodySchema.parse)

  log.info('AUDIT: Processing image upload', { userId: user.id })

  try {
    // 1. Decode base64
    // Format is typically: data:image/jpeg;base64,/9j/4AAQSkZJRgAB...
    const matches = body.imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/)

    if (!matches || matches.length !== 3) {
      throw createError({ statusCode: 400, message: 'Invalid base64 image data' })
    }

    const mimeType = matches[1] || 'image/png'
    const b64Data = matches[2]

    if (!b64Data) {
      throw createError({ statusCode: 400, message: 'Invalid base64 image data' })
    }

    // Convert base64 string to buffer
    const binaryStr = atob(b64Data)
    const len = binaryStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const buffer = bytes.buffer

    // 2. Upload to R2
    const id = crypto.randomUUID()

    // Determine extension from mime type
    const extRaw = mimeType.split('/')[1] || 'png'
    const extension = extRaw === 'jpeg' ? 'jpg' : extRaw
    const r2Key = `uploads/${user.id}/${id}.${extension}`

    await uploadToR2(event, r2Key, buffer, mimeType)

    // 3. Create generation record
    const now = new Date().toISOString()
    const db = useDatabase(event)

    const record = {
      id,
      userId: user.id,
      type: 'image' as const,
      mode: 't2i' as const, // Treat it conceptually like an image generation output
      prompt: 'Uploaded Image',
      status: 'done' as const,
      r2Key,
      mediaUrl: `/api/media/${r2Key}`,
      thumbnailUrl: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(generations).values(record)

    log.info('Upload complete', { userId: user.id, r2Key })

    return record
  } catch (error) {
    const err = error as Error & { statusCode?: number }
    log.error('Upload failed', { error: err.message, userId: user.id })
    if (err.statusCode) {
      throw err // rethrow specific H3 errors
    }
    throw createError({ statusCode: 500, message: 'Failed to process and upload image' })
  }
})
