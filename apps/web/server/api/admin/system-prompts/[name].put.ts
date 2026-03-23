import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { systemPrompts } from '#server/database/schema'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  content: z.string().min(1),
})

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-system-prompt-update', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, admin: user, body }) => {
    const log = useLogger(event).child('AdminSystemPrompts')
    const name = getRouterParam(event, 'name')

    if (!name) {
      throw createError({ statusCode: 400, message: 'Missing system prompt name' })
    }

    const db = useAppDatabase(event)
    const now = new Date().toISOString()

    await db
      .update(systemPrompts)
      .set({ content: body.content, updatedAt: now })
      .where(eq(systemPrompts.name, name))
      .execute()

    log.info(`System prompt '${name}' updated`, { userId: user.id })

    return { success: true }
  },
)
