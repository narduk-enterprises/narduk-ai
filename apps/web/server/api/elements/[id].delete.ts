import { eq, and } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

/**
 * DELETE /api/elements/[id] — Delete a prompt element.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'delete-element', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event, user }) => {
    const log = useLogger(event).child('PromptElements')
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing element ID' })
    }

    const db = useDatabase(event)

    const result = await db
      .delete(promptElements)
      .where(and(eq(promptElements.id, id), eq(promptElements.userId, user.id)))
      .returning({ id: promptElements.id })
      .get()

    if (!result) {
      throw createError({ statusCode: 404, message: 'Element not found' })
    }

    log.info('Prompt element deleted', { userId: user.id, elementId: id })

    return { success: true, id }
  },
)
