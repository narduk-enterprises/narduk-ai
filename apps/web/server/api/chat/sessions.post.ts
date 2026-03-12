import { z } from 'zod'
import { chatSessions } from '#server/database/schema'

const bodySchema = z.object({
  mode: z.enum(['general', 'person', 'scene', 'framing', 'action', 'style']).default('general'),
  model: z.string().max(64).default('grok-3-mini'),
  title: z.string().max(200).optional(),
})

/**
 * POST /api/chat/sessions — Create a new chat session.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'chat-sessions-create', 20, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDatabase(event)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await db.insert(chatSessions).values({
    id,
    userId: user.id,
    mode: body.mode,
    model: body.model,
    title: body.title || null,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id,
    mode: body.mode,
    model: body.model,
    title: body.title || null,
    createdAt: now,
    updatedAt: now,
  }
})
