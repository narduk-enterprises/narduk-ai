import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { appSettings, generations } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import { createGenerationComparisonDefaults } from '#server/utils/imageComparisons'

interface StoredImageGenerationParams {
  userId: string
  prompt: string
  aspectRatio?: string
  model?: string
  promptElements?: string[]
  presets?: Record<string, string>
  userPromptId?: string
  lineage?: string
  n?: number
}

interface LoggerLike {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
}

export async function resolveImageModel(
  event: H3Event,
  preferredModel: string | undefined,
  log: LoggerLike,
) {
  if (preferredModel) return preferredModel

  const db = useAppDatabase(event)

  try {
    const settings = await db
      .select({ imageModel: appSettings.imageModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()

    if (settings?.imageModel) return settings.imageModel
  } catch (err) {
    log.warn('Could not fetch appSettings for imageModel', { err })
  }

  return 'grok-imagine-image'
}

export async function generateStoredImages(
  event: H3Event,
  params: StoredImageGenerationParams,
  log: LoggerLike,
) {
  const config = useRuntimeConfig(event)
  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const imageModel = await resolveImageModel(event, params.model, log)
  const db = useAppDatabase(event)

  log.info('T2I using model', {
    imageModel,
    count: params.n || 1,
  })

  const startTimeMs = Date.now()
  const result = await grokGenerateImage(config.xaiApiKey, {
    prompt: params.prompt,
    model: imageModel,
    aspectRatio: params.aspectRatio,
    n: params.n || 1,
  })
  const generationTimeMs = Date.now() - startTimeMs

  const images = result.data || []
  if (!images.length) {
    log.error('T2I failed — no image returned', { userId: params.userId })
    throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
  }

  const uploads: Array<
    Promise<
      | typeof generations.$inferSelect
      | {
          id: string
          userId: string
          type: 'image'
          mode: 't2i'
          prompt: string
          status: 'done'
          r2Key: string
          mediaUrl: string
          comparisonScore: number
          comparisonWins: number
          comparisonLosses: number
          lastComparedAt: null
          aspectRatio: string | null
          promptElements: string | null
          presets: string | null
          lineage: string | null
          userPromptId: string | null
          metadata: string
          generationTimeMs: number
          createdAt: string
          updatedAt: string
        }
    >
  > = []

  for (const imageData of images) {
    uploads.push(
      (async () => {
        const imageUrl = imageData?.url
        if (!imageUrl) {
          throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
        }

        const id = crypto.randomUUID()
        const r2Key = `generations/${params.userId}/${id}.png`

        try {
          const buffer = await downloadMedia(imageUrl)
          await uploadToR2(event, r2Key, buffer, 'image/png')
        } catch (err) {
          log.error('R2 upload failed', { userId: params.userId, generationId: id, err })
          throw createError({ statusCode: 500, message: 'Failed to save generated image' })
        }

        const now = new Date().toISOString()
        const record = {
          id,
          userId: params.userId,
          type: 'image' as const,
          mode: 't2i' as const,
          prompt: params.prompt,
          status: 'done' as const,
          r2Key,
          mediaUrl: `/api/media/${r2Key}`,
          ...createGenerationComparisonDefaults(),
          aspectRatio: params.aspectRatio || null,
          promptElements: params.promptElements ? JSON.stringify(params.promptElements) : null,
          presets: params.presets ? JSON.stringify(params.presets) : null,
          lineage: params.lineage || null,
          userPromptId: params.userPromptId || null,
          metadata: JSON.stringify({ revised_prompt: imageData.revised_prompt }),
          generationTimeMs,
          createdAt: now,
          updatedAt: now,
        }

        await db.insert(generations).values(record)
        return record
      })(),
    )
  }

  const storedRecords = await Promise.all(uploads)

  return storedRecords
}
