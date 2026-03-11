import { eq, desc } from 'drizzle-orm'
import { userPrompts } from '../../database/schema'

/**
 * GET /api/prompts — Get all saved prompts for the current user.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDatabase(event)

  const elements = await db
    .select()
    .from(userPrompts)
    .where(eq(userPrompts.userId, user.id))
    .orderBy(desc(userPrompts.createdAt))

  return elements
})
