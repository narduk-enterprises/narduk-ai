import { eq } from 'drizzle-orm'
import { promptElementVariants } from '../../database/schema'

/**
 * DELETE /api/variants/:id — Delete a variant.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Variant ID required' })

  const db = useDatabase(event)

  await db.delete(promptElementVariants).where(eq(promptElementVariants.id, id))

  return { ok: true }
})
