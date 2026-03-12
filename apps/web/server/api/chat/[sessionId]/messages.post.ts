import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { chatSessions, chatMessages } from '#server/database/schema'

const bodySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string().min(1).max(500_000), z.array(z.any()).min(1).max(10)]),
  parsedResponse: z.any().optional(),
  sessionTitle: z.string().max(200).optional(), // If provided, updates the session title
})

/**
 * POST /api/chat/[sessionId]/messages — Append a message to a session.
 * Also updates session.updatedAt (and optionally title).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'chat-messages-write', 120, 60_000)

  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) throw createError({ statusCode: 400, message: 'Missing sessionId' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase(event)
  const now = new Date().toISOString()

  // Verify ownership
  const session = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id)))
    .get()

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })

  const id = crypto.randomUUID()

  await db.insert(chatMessages).values({
    id,
    sessionId,
    role: body.role,
    content: typeof body.content === 'string' ? body.content : JSON.stringify(body.content),
    parsedResponse: body.parsedResponse ? JSON.stringify(body.parsedResponse) : null,
    createdAt: now,
  })

  // Update session timestamp (and title if provided)
  await db
    .update(chatSessions)
    .set({
      updatedAt: now,
      ...(body.sessionTitle ? { title: body.sessionTitle } : {}),
    })
    .where(eq(chatSessions.id, sessionId))

  return { id, sessionId, createdAt: now }
})
