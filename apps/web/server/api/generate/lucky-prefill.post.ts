import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { luckyPrompts, promptElements, appSettings } from '../../database/schema'

const bodySchema = z.object({
  count: z.number().int().min(1).max(10).optional().default(5),
  mediaType: z.enum(['image', 'video']).optional().default('image'),
})

/**
 * POST /api/generate/lucky-prefill — Batch-generate lucky prompts and cache them in D1.
 *
 * Picks random preset combinations and calls Grok to produce creative prompts,
 * storing each result in the lucky_prompts table for near-instant consumption.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('LuckyPrefill')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'lucky-prefill', 5, 60_000)

  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const db = useDatabase(event)

  // Fetch user's presets
  const allElements = await db
    .select()
    .from(promptElements)
    .where(eq(promptElements.userId, user.id))

  if (!allElements.length) {
    throw createError({
      statusCode: 400,
      message: 'No presets available. Create some presets first!',
    })
  }

  // Group elements by type
  const byType: Record<string, typeof allElements> = {}
  for (const el of allElements) {
    if (!byType[el.type]) byType[el.type] = []
    byType[el.type]!.push(el)
  }

  // Fetch configured model
  let chatModel = 'grok-3-mini'
  try {
    const settings = await db
      .select({ promptEnhanceModel: appSettings.promptEnhanceModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()
    if (settings?.promptEnhanceModel) {
      chatModel = settings.promptEnhanceModel
    }
  } catch {
    // use default
  }

  const mediaLabel = body.mediaType === 'video' ? 'video' : 'image'
  const isVideo = body.mediaType === 'video'
  const now = new Date().toISOString()
  let generated = 0

  // Generate each prompt in parallel
  const results = await Promise.allSettled(
    Array.from({ length: body.count }, async () => {
      // Pick random presets (same logic as the client-side handleFeelingLucky)
      const picked: Record<string, string> = {}
      const pickedContent: string[] = []

      if (byType.person?.length) {
        const person = byType.person[Math.floor(Math.random() * byType.person.length)]!
        picked.person = person.name
        pickedContent.push(`person: ${person.content}`)
      }

      const otherTypes = ['scene', 'framing', 'action', 'style'].filter((t) => byType[t]?.length)
      const shuffled = otherTypes.sort(() => Math.random() - 0.5)
      const pickCount = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
      for (let i = 0; i < pickCount; i++) {
        const type = shuffled[i]!
        const el = byType[type]![Math.floor(Math.random() * byType[type]!.length)]!
        picked[type] = el.name
        pickedContent.push(`${type}: ${el.content}`)
      }

      if (!pickedContent.length) return null

      // Call Grok directly (server-side, no HTTP round-trip)
      const responseContent = await grokChat(
        config.xaiApiKey,
        [
          {
            role: 'system',
            content:
              `You are a wildly creative ${mediaLabel} prompt generator for Grok Imagine. ` +
              `The user has given you some preset components. Your job is to invent an AMAZING, ` +
              `unexpected, and visually stunning scenario using these components. Be bold and imaginative — ` +
              `surreal situations are great (e.g. riding a rhino at a football game, having tea on the moon, ` +
              `swimming with whales in a city). The crazier the better!\n\n` +
              `CRITICAL PHOTOREALISM RULES:\n` +
              `- The ${mediaLabel} MUST look like it was captured by a REAL camera — photorealistic, cinematic, lifelike\n` +
              `- Include anchors like "photorealistic", "shot on Sony A7IV", "natural lighting", "shallow depth of field", "film grain", "35mm"\n` +
              `- NEVER produce anything that looks like CGI, cartoon, anime, illustration, 3D render, digital art, painting, or fantasy art\n` +
              `- Real skin textures, real environments, real physics of light — even if the scenario itself is impossible\n` +
              `- Think of it as "what if a photographer actually captured this impossible moment?"\n` +
              (isVideo
                ? `- For video: emphasize natural motion, camera movement, temporal progression, and cinematic pacing\n`
                : '') +
              `\nReturn JSON ONLY: { "prompt": "the complete generation prompt" }`,
          },
          {
            role: 'user',
            content: `Here are my presets — invent something wild:\n\n${pickedContent.join('\n')}`,
          },
        ],
        chatModel,
        { type: 'json_object' },
      )

      const parsed = JSON.parse(responseContent)
      const prompt = (parsed.prompt || '') as string
      if (!prompt) return null

      // Store in D1
      const id = crypto.randomUUID()
      await db.insert(luckyPrompts).values({
        id,
        userId: user.id,
        prompt,
        mediaType: body.mediaType,
        presets: JSON.stringify(picked),
        presetContent: JSON.stringify(pickedContent),
        consumed: 0,
        createdAt: now,
      })

      generated++
      return { id, prompt }
    }),
  )

  const errors = results.filter((r) => r.status === 'rejected').length
  log.info('Lucky prefill complete', {
    userId: user.id,
    generated,
    errors,
    mediaType: body.mediaType,
  })

  return { generated, errors, mediaType: body.mediaType }
})
