import { eq, and, sql } from 'drizzle-orm'
import { luckyPrompts, promptElements, appSettings } from '#server/database/schema'
import { xaiImagineChat } from '#server/utils/grok'

// How many cached prompts each user should have available per media type
const TARGET_CACHE_SIZE = 5
// How many to generate per batch when refilling
const BATCH_SIZE = 5

/**
 * GET /api/cron/refill-lucky — Auto-refill lucky prompt cache for all users with presets.
 *
 * Called by the cron plugin. For each user who has presets, checks if they have
 * fewer than TARGET_CACHE_SIZE available lucky prompts, and generates more if needed.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('CronRefillLucky')
  const config = useRuntimeConfig(event)

  // Auth: same pattern as sync-jobs
  if (config.cronSecret) {
    const authHeader = getHeader(event, 'Authorization')
    if (authHeader !== `Bearer ${config.cronSecret}`) {
      throw createError({ statusCode: 401, message: 'Unauthorized cron runner' })
    }
  }

  if (!config.xaiApiKey) {
    return { status: 'skipped', message: 'No xAI API key' }
  }

  const db = useDatabase(event)

  // Find distinct users who have presets
  const usersWithPresets = await db
    .selectDistinct({ userId: promptElements.userId })
    .from(promptElements)

  if (!usersWithPresets.length) {
    return { status: 'ok', message: 'No users with presets', refilled: 0 }
  }

  // Fetch configured chat model
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

  let totalRefilled = 0

  for (const { userId } of usersWithPresets) {
    // Check how many available cached prompts the user has (image only for now)
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(luckyPrompts)
      .where(
        and(
          eq(luckyPrompts.userId, userId),
          eq(luckyPrompts.consumed, 0),
          eq(luckyPrompts.mediaType, 'image'),
        ),
      )
      .get()

    const available = countResult?.count ?? 0
    if (available >= TARGET_CACHE_SIZE) continue

    // Need to generate more
    const needed = TARGET_CACHE_SIZE - available

    // Fetch this user's presets
    const userElements = await db
      .select()
      .from(promptElements)
      .where(eq(promptElements.userId, userId))

    if (!userElements.length) continue

    const byType: Record<string, typeof userElements> = {}
    for (const el of userElements) {
      if (!byType[el.type]) byType[el.type] = []
      byType[el.type]!.push(el)
    }

    const now = new Date().toISOString()
    const batchCount = Math.min(needed, BATCH_SIZE)

    const results = await Promise.allSettled(
      Array.from({ length: batchCount }, async () => {
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

        const responseContent = await xaiImagineChat(
          config.xaiApiKey,
          [
            {
              role: 'system',
              content:
                `You are a wildly creative image prompt generator for Grok Imagine. ` +
                `The user has given you some preset components. Your job is to invent an AMAZING, ` +
                `unexpected, and visually stunning scenario using these components. Be bold and imaginative — ` +
                `surreal situations are great (e.g. riding a rhino at a football game, having tea on the moon, ` +
                `swimming with whales in a city). The crazier the better!\n\n` +
                `CRITICAL PHOTOREALISM RULES:\n` +
                `- The image MUST look like it was captured by a REAL camera — photorealistic, cinematic, lifelike\n` +
                `- Include anchors like "photorealistic", "shot on Sony A7IV", "natural lighting", "shallow depth of field", "film grain", "35mm"\n` +
                `- NEVER produce anything that looks like CGI, cartoon, anime, illustration, 3D render, digital art, painting, or fantasy art\n` +
                `- Real skin textures, real environments, real physics of light — even if the scenario itself is impossible\n` +
                `- Think of it as "what if a photographer actually captured this impossible moment?"\n` +
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

        const id = crypto.randomUUID()
        await db.insert(luckyPrompts).values({
          id,
          userId,
          prompt,
          mediaType: 'image',
          presets: JSON.stringify(picked),
          presetContent: JSON.stringify(pickedContent),
          consumed: 0,
          createdAt: now,
        })
        return id
      }),
    )

    const generated = results.filter((r) => r.status === 'fulfilled' && r.value).length
    totalRefilled += generated
    log.info('Refilled lucky cache', { userId, generated, needed })
  }

  return { status: 'ok', refilled: totalRefilled, usersChecked: usersWithPresets.length }
})
