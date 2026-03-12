import type { H3Event } from 'h3'
import { generations } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import { downloadMedia } from '#server/utils/grok'
import { createGenerationComparisonDefaults } from '#server/utils/imageComparisons'

interface PersistGeneratedImageOptions {
  userId: string
  prompt: string
  mode?: 't2i' | 'i2i'
  remoteImageUrl: string
  sourceGenerationId?: string | null
  aspectRatio?: string | null
  metadata?: Record<string, unknown> | null
  promptElements?: string[] | null
  presets?: Record<string, string> | null
  lineage?: string | null
  userPromptId?: string | null
  generationTimeMs?: number | null
  failureMessage?: string
}

export async function persistGeneratedImage(event: H3Event, options: PersistGeneratedImageOptions) {
  const db = useAppDatabase(event)
  const id = crypto.randomUUID()
  const r2Key = `generations/${options.userId}/${id}.png`

  try {
    const buffer = await downloadMedia(options.remoteImageUrl)
    await uploadToR2(event, r2Key, buffer, 'image/png')
  } catch {
    throw createError({
      statusCode: 500,
      message: options.failureMessage || 'Failed to save generated image',
    })
  }

  const now = new Date().toISOString()
  const record = {
    id,
    userId: options.userId,
    type: 'image' as const,
    mode: options.mode || 't2i',
    prompt: options.prompt,
    sourceGenerationId: options.sourceGenerationId || null,
    status: 'done' as const,
    r2Key,
    mediaUrl: `/api/media/${r2Key}`,
    thumbnailUrl: null,
    ...createGenerationComparisonDefaults(),
    aspectRatio: options.aspectRatio || null,
    promptElements: options.promptElements ? JSON.stringify(options.promptElements) : null,
    presets: options.presets ? JSON.stringify(options.presets) : null,
    lineage: options.lineage || null,
    userPromptId: options.userPromptId || null,
    metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    generationTimeMs: options.generationTimeMs ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(generations).values(record)

  return record
}
