import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  presets: z.record(z.string(), z.string()),
})

/**
 * POST /api/elements/resolve-presets — Resolve preset names to their full content.
 * Accepts { presets: Record<string, string> } (type → name) and returns resolved content.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'resolve-presets', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event, user }) => {
    const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase(event)

  const names = Object.values(body.presets).filter(Boolean)
  if (!names.length) return { resolved: {} }

  type PromptElementRow = {
    type: string
    name: string
    content: string
  }

  // Fetch all matching elements in one query
  const rows: PromptElementRow[] = await db
    .select({
      type: promptElements.type,
      name: promptElements.name,
        content: promptElements.content,
      })
      .from(promptElements)
      .where(and(eq(promptElements.userId, user.id), inArray(promptElements.name, names)))

    // Build resolved map keyed by preset type
    const resolved: Record<string, { name: string; content: string }> = {}
    for (const [type, name] of Object.entries(body.presets)) {
      const match = rows.find((r) => r.name === name && r.type === type)
      if (match) {
        resolved[type] = { name: match.name, content: match.content }
      }
    }

    return { resolved }
  },
)
