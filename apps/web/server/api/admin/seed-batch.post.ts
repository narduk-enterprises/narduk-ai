import { z } from 'zod'
import { generateStoredImages } from '#server/utils/imageGeneration'

const bodySchema = z.object({
  /** Base prompt template — person description will be prepended */
  basePrompt: z
    .string()
    .min(1)
    .max(2000)
    .default(
      'standing naturally, hands on hips, full body shot, white studio background, soft natural lighting, photorealistic, shot on Sony A7IV, 35mm',
    ),
  /** Number of person variations to generate */
  count: z.coerce.number().min(1).max(100).default(10),
  /** Aspect ratio for all generated images */
  aspectRatio: z.string().optional(),
  /** Optional label for the batch */
  label: z.string().max(200).optional(),
  /** Optional client-provided batchId for progress polling */
  batchId: z.string().uuid().optional(),
})

interface PersonVariation {
  name: string
  description: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const batchId = body.batchId || crypto.randomUUID()
  const now = new Date().toISOString()

  log.info('AUDIT: Seed batch started', {
    action: 'seed_batch',
    userId: user.id,
    batchId,
    count: body.count,
  })

  // Step 1: Generate person variations via Grok Chat
  // Use the basePrompt to derive what kind of subject variations to create
  const variationsPrompt = `You are generating ${body.count} unique visual variations for AI image generation.

The user's base prompt is: "${body.basePrompt}"

Analyze the base prompt to understand the subject (person, object, scene, etc.) and generate ${body.count} COMPLETELY DIFFERENT variations of that subject. Each variation should change the visual attributes dramatically while keeping the same general category.

For people: vary hair color/style, body type, facial features, clothing, accessories, skin tone, eye color, overall vibe.
For objects/scenes: vary materials, colors, lighting, style, composition, mood.

Rules:
- Each description should be 1-2 sentences max, written as comma-separated visual descriptors
- The descriptors will be PREPENDED to the base prompt, so don't repeat what's already in the base prompt (like pose or framing)
- NO names, NO backstories — visual descriptors only

Return JSON ONLY: { "variations": [{ "name": "short-kebab-case-id", "description": "the visual descriptors" }, ...] }`

  let variations: PersonVariation[]

  try {
    const chatResult = await grokChat(
      config.xaiApiKey,
      [
        {
          role: 'system',
          content:
            'You are a creative character designer for AI image generation. Return valid JSON only.',
        },
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
  } catch (err) {
    log.error('Failed to generate person variations', { err, batchId })
    throw createError({
      statusCode: 502,
      message: 'Failed to generate person variations via Grok Chat',
    })
  }

  // Step 2: Generate images in parallel
  // The rate limiter in grok.ts gates API call starts at 1.1s intervals,
  // but actual image generation (5-10s) overlaps — much faster than sequential.
  const maxRetries = 3

  async function generateOne(variation: PersonVariation) {
    const prompt = `${variation.description}, ${body.basePrompt}`
    let attempt = 0

    while (attempt < maxRetries) {
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

          return { variationName: variation.name, generationId: record.id }
        }

        return null
      } catch (err) {
        if (attempt >= maxRetries) {
          log.warn('Seed batch image failed', {
            batchId,
            variation: variation.name,
            attempt,
            err: err instanceof Error ? err.message : String(err),
          })
          return null
        }
        // Brief pause before retry (the rate limiter handles the main pacing)
        await sleep(1000 * attempt)
      }
    }
    return null
  }

  const results = await Promise.all(variations.map((variation) => generateOne(variation)))
  const failures = results.filter((r) => r === null).length

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
