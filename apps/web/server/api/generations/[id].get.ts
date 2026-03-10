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

  // Auto-expire stale pending generations (>10 min)
  if (gen.status === 'pending') {
    if (isGenerationStale(gen.createdAt)) {
      const now = new Date().toISOString()
      await db
        .update(generations)
        .set({ status: 'failed', metadata: TIMEOUT_ERROR_META, updatedAt: now })
        .where(eq(generations.id, gen.id))

      log.warn('Generation auto-expired', {
        generationId: id,
        ageMinutes: Math.round((Date.now() - new Date(gen.createdAt).getTime()) / 60000),
      })

      return { ...gen, status: 'failed' as const, metadata: TIMEOUT_ERROR_META, updatedAt: now }
    }
  }

  log.debug('Generation fetched', { generationId: id, type: gen.type, status: gen.status })

  return gen
})
