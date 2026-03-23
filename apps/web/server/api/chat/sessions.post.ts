import { z } from 'zod'
import { chatSessions } from '#server/database/schema'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  mode: z
    .enum(['general', 'person', 'scene', 'framing', 'action', 'style', 'clothing'])
    .default('general'),
  model: z.string().max(64).default('grok-3-mini'),
  title: z.string().max(200).optional(),
})

/**
 * POST /api/chat/sessions — Create a new chat session.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'chat-sessions-create', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const db = useAppDatabase(event)
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
  },
)
