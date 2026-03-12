import { eq, and } from 'drizzle-orm'
import { generations } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'

/**
 * DELETE /api/generations/[id] — Delete a generation + its R2 asset.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Generations')
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing generation ID' })
  }

  const db = useAppDatabase(event)

  const gen = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, user.id)))
    .get()

  if (!gen) {
    throw createError({ statusCode: 404, message: 'Generation not found' })
  }

  // Delete R2 object if present
  if (gen.r2Key) {
    try {
      await deleteFromR2(event, gen.r2Key)
      log.info('R2 asset deleted', { r2Key: gen.r2Key })
    } catch {
      log.warn('R2 delete failed (non-fatal)', { r2Key: gen.r2Key })
    }
  }

  // Delete D1 record
  await db.delete(generations).where(eq(generations.id, id))

  log.info('Generation deleted', { userId: user.id, generationId: id, type: gen.type })

  return { deleted: true }
})
