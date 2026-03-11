import { eq, and } from 'drizzle-orm'
import { promptElements } from '../../database/schema'

/**
 * DELETE /api/elements/[id] — Delete a prompt element.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('PromptElements')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'delete-element', 30, 60_000)

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
})
