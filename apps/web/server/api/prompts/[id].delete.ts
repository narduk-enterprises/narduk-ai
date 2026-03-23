import { eq, and } from 'drizzle-orm'
import { userPrompts } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

/**
 * DELETE /api/prompts/:id — Delete a saved prompt.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'delete-prompt', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event, user }) => {
    const log = useLogger(event).child('UserPrompts')
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing prompt ID' })
    }

    const db = useDatabase(event)

    const existing = await db
      .select({ id: userPrompts.id })
      .from(userPrompts)
      .where(and(eq(userPrompts.id, id), eq(userPrompts.userId, user.id)))
      .get()

    if (!existing) {
      throw createError({ statusCode: 404, message: 'Prompt not found or unauthorized' })
    }

    await db.delete(userPrompts).where(eq(userPrompts.id, id))

    log.info('Prompt deleted', { userId: user.id, promptId: id })
    return { success: true }
  },
)
