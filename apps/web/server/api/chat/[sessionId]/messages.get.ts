import { eq, and } from 'drizzle-orm'
import { chatSessions, chatMessages } from '#server/database/schema'

/**
 * GET /api/chat/[sessionId]/messages — Load all messages for a session.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'chat-messages', 120, 60_000)

  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: 'Missing sessionId' })

  const db = useDatabase(event)

  // Verify ownership
  const session = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id)))
    .get()

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .all()

  return { session, messages }
})
