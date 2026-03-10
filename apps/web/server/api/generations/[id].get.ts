import { eq, and } from 'drizzle-orm'
import { generations } from '../../database/schema'

/**
 * GET /api/generations/[id] — Get a single generation by ID (user-scoped).
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generations')
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing generation ID' })
  }

  const db = useDatabase(event)

  const gen = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, user.id)))
    .get()

  if (!gen) {
    log.warn('Generation not found', { userId: user.id, generationId: id })
    throw createError({ statusCode: 404, message: 'Generation not found' })
  }

  log.debug('Generation fetched', { generationId: id, type: gen.type, status: gen.status })

  return gen
})
