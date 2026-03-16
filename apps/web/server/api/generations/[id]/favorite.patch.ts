import { eq, and } from 'drizzle-orm'
import { generations } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'

/**
 * PATCH /api/generations/:id/favorite — Toggle favorite status.
 * Returns the updated generation row.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing generation ID' })
  }

  await enforceRateLimit(event, 'favorite', 30, 60_000)

  const db = useAppDatabase(event)

  // Fetch current row
  const [existing] = await db
    .select({ id: generations.id, isFavorite: generations.isFavorite })
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, user.id)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Generation not found' })
  }

  const newValue = existing.isFavorite === 1 ? 0 : 1
  const now = new Date().toISOString()

  await db
    .update(generations)
    .set({ isFavorite: newValue, updatedAt: now })
    .where(eq(generations.id, id))

  // Return full updated row
  const [updated] = await db.select().from(generations).where(eq(generations.id, id)).limit(1)

  return updated
})
