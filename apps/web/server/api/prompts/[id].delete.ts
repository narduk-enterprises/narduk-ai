import { eq, and } from 'drizzle-orm'
import { userPrompts } from '../../database/schema'

/**
 * DELETE /api/prompts/:id — Delete a saved prompt.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('UserPrompts')
  const user = await requireAuth(event)

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
})
