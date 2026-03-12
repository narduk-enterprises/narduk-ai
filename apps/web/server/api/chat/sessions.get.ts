import { desc, eq } from 'drizzle-orm'
import { chatSessions } from '#server/database/schema'

const MAX_SESSIONS_PER_USER = 20

/**
 * GET /api/chat/sessions — List the current user's chat sessions (newest first).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'chat-sessions', 60, 60_000)

  const db = useDatabase(event)

  const sessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, user.id))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(MAX_SESSIONS_PER_USER)
    .all()

  return sessions
})
