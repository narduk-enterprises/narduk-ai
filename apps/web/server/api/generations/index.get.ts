import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { generations } from '../../database/schema'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

/**
 * GET /api/generations — List user's generations (newest first).
 * Supports ?limit=N&offset=N query params.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generations')
  const user = await requireAuth(event)
  const { limit, offset } = querySchema.parse(getQuery(event))

  const db = useDatabase(event)

  const rows = await db
    .select()
    .from(generations)
    .where(eq(generations.userId, user.id))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset)

  log.debug('Generations listed', { userId: user.id, count: rows.length, limit, offset })

  return rows
})
