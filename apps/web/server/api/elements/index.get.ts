import { eq, desc } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'

/**
 * GET /api/elements — List user's prompt elements (newest first).
 *
 * Excludes `chatHistory` and `attributes` — they add ~260KB of payload
 * that the menus/dropdowns never use. Use GET /api/elements/:id for full data.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('PromptElements')
  const user = await requireAuth(event)

  const db = useDatabase(event)

  const rows = await db
    .select({
      id: promptElements.id,
      userId: promptElements.userId,
      type: promptElements.type,
      name: promptElements.name,
      content: promptElements.content,
      metadata: promptElements.metadata,
      createdAt: promptElements.createdAt,
      updatedAt: promptElements.updatedAt,
    })
    .from(promptElements)
    .where(eq(promptElements.userId, user.id))
    .orderBy(desc(promptElements.createdAt))

  log.debug('Prompt elements listed', { userId: user.id, count: rows.length })

  return rows
})
