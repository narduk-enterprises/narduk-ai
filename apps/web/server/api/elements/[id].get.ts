import { eq, and } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'

/**
 * GET /api/elements/:id — Fetch a single prompt element by ID.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing element ID' })
  }

  const db = useDatabase(event)

  const [row] = await db
    .select()
    .from(promptElements)
    .where(and(eq(promptElements.id, id), eq(promptElements.userId, user.id)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, message: 'Element not found' })
  }

  return row
})
