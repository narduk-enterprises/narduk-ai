import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { luckyPrompts } from '../../database/schema'

const bodySchema = z.object({
  mediaType: z.enum(['image', 'video']).optional().default('image'),
})

/**
 * POST /api/generate/lucky-consume — Pop a cached lucky prompt for instant use.
 *
 * Returns one available cached prompt and marks it consumed.
 * If no cached prompts are available, returns { cached: false } so the client
 * can fall back to real-time Grok generation.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'lucky-consume', 30, 60_000)

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase(event)

  // Fetch all available (unconsumed) lucky prompts for this user + media type
  const available = await db
    .select()
    .from(luckyPrompts)
    .where(
      and(
        eq(luckyPrompts.userId, user.id),
        eq(luckyPrompts.consumed, 0),
        eq(luckyPrompts.mediaType, body.mediaType),
      ),
    )
    .limit(10)

  if (!available.length) {
    return { cached: false }
  }

  // Pick a random one from available rows
  const pick = available[Math.floor(Math.random() * available.length)]!

  // Mark it consumed
  await db.update(luckyPrompts).set({ consumed: 1 }).where(eq(luckyPrompts.id, pick.id))

  return {
    cached: true,
    prompt: pick.prompt,
    presets: JSON.parse(pick.presets) as Record<string, string>,
    presetContent: JSON.parse(pick.presetContent) as string[],
  }
})
