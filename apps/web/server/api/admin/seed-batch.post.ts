import { z } from 'zod'
import { generateStoredImages } from '#server/utils/imageGeneration'

const bodySchema = z.object({
  /** Base prompt template — person description will be prepended */
  basePrompt: z.string().min(1).max(2000).default(
    'standing naturally, hands on hips, full body shot, white studio background, soft natural lighting, photorealistic, shot on Sony A7IV, 35mm',
  ),
  /** Number of person variations to generate */
  count: z.coerce.number().min(1).max(100).default(10),
  /** Aspect ratio for all generated images */
  aspectRatio: z.string().optional(),
  /** Optional label for the batch */
  label: z.string().max(200).optional(),
})

interface PersonVariation {
  name: string
  description: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isConcurrentLimitError(err: unknown) {
  if (!(err instanceof Error)) return false
  return err.message.toLowerCase().includes('too many concurrent requests')
}

/**
 * POST /api/admin/seed-batch — Generate a batch of images varying person descriptions.
 *
 * Uses Grok Chat to invent N unique person descriptions, then generates an image
 * for each using a fixed base prompt. Each generation is tagged with a batchId
 * in its metadata so they can be filtered and compared as a group.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('SeedBatch')
  const user = await requireAdmin(event)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const body = await readValidatedBody(event, bodySchema.parse)
  const batchId = crypto.randomUUID()
  const now = new Date().toISOString()

  log.info('AUDIT: Seed batch started', {
    action: 'seed_batch',
    userId: user.id,
    batchId,
    count: body.count,
  })

  // Step 1: Generate person variations via Grok Chat
  const variationsPrompt = `Generate exactly ${body.count} unique, diverse person descriptions for AI image generation. Each person should be a 20-30 year old white woman with a COMPLETELY DIFFERENT look — vary hair color, hair style, body type, facial features, clothing, accessories, freckles, skin tone variation, eye color, and overall vibe.

Be concise — each description should be 1-2 sentences max, written as comma-separated visual descriptors ready to prepend to a generation prompt. NO names, NO backstories.

Examples of good descriptions:
- "Petite woman with wavy auburn hair, light freckles, green eyes, wearing a cropped white tee and high-waisted jeans, delicate gold necklace"
- "Tall athletic woman with straight platinum blonde hair in a low ponytail, blue eyes, tanned skin, wearing a fitted black tank top and denim shorts"
- "Curvy woman with shoulder-length dark brown hair, hazel eyes, rosy cheeks, wearing an oversized knit sweater and leggings, silver hoop earrings"

Return JSON ONLY: { "variations": [{ "name": "short-kebab-case-id", "description": "the visual descriptors" }, ...] }`

  let variations: PersonVariation[]

  try {
    const chatResult = await grokChat(
      config.xaiApiKey,
      [
        { role: 'system', content: 'You are a creative character designer for AI image generation. Return valid JSON only.' },
        { role: 'user', content: variationsPrompt },
      ],
      'grok-3-mini',
      { type: 'json_object' },
    )

    const parsed = JSON.parse(chatResult) as { variations: PersonVariation[] }
    variations = parsed.variations

    if (!Array.isArray(variations) || variations.length === 0) {
      throw new Error('No variations returned from Grok Chat')
    }

    log.info('Generated person variations', { count: variations.length, batchId })
  }
  catch (err) {
    log.error('Failed to generate person variations', { err, batchId })
    throw createError({ statusCode: 502, message: 'Failed to generate person variations via Grok Chat' })
  }

  // Step 2: Generate images for each variation using bounded concurrency
  const maxConcurrent = Math.max(
    1,
    Math.min(20, Number(config.xaiImportedImageMaxConcurrent || 10)),
  )
  const maxRetries = Math.max(1, Math.min(5, Number(config.xaiImportedImageMaxRetries || 3)))
  const retryDelayMs = Math.max(250, Number(config.xaiImportedImageRetryDelayMs || 1500))

  const results: Array<{ variationName: string; generationId: string } | null> = new Array(variations.length).fill(null)
  let failures = 0
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < variations.length) {
      const currentIndex = nextIndex
      nextIndex++
      const variation = variations[currentIndex]
      if (!variation) continue

      const prompt = `${variation.description}, ${body.basePrompt}`
      let attempt = 0
      let completed = false

      while (attempt < maxRetries && !completed) {
        attempt++
        try {
          const stored = await generateStoredImages(
            event,
            {
              userId: user.id,
              prompt,
              aspectRatio: body.aspectRatio,
              n: 1,
            },
            log,
          )

          const record = stored[0]
          if (record) {
            // Tag the generation with batch metadata
            const db = useDatabase(event)
            const existingMeta = record.metadata ? JSON.parse(record.metadata) : {}
            const updatedMeta = JSON.stringify({
              ...existingMeta,
              batchId,
              batchDimension: 'person',
              batchLabel: body.label || null,
              variationName: variation.name,
              variationDescription: variation.description,
            })

            const { generations } = await import('#server/database/schema')
            const { eq } = await import('drizzle-orm')
            await db
              .update(generations)
              .set({ metadata: updatedMeta, updatedAt: now })
              .where(eq(generations.id, record.id))

            results[currentIndex] = {
              variationName: variation.name,
              generationId: record.id,
            }
          }

          completed = true
        }
        catch (err) {
          if (!isConcurrentLimitError(err) || attempt >= maxRetries) {
            failures++
            completed = true
            log.warn('Seed batch image failed', {
              batchId,
              variation: variation.name,
              attempt,
              err: err instanceof Error ? err.message : String(err),
            })
            continue
          }

          await sleep(retryDelayMs * attempt)
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, variations.length) }, () => worker()),
  )

  const successful = results.filter((r): r is NonNullable<typeof r> => r !== null)

  log.info('AUDIT: Seed batch complete', {
    action: 'seed_batch_complete',
    userId: user.id,
    batchId,
    generated: successful.length,
    failures,
  })

  return {
    batchId,
    label: body.label || null,
    dimension: 'person',
    generated: successful.length,
    failures,
    results: successful,
  }
})
