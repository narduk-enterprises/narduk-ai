import { eq } from 'drizzle-orm'
import { promptElementVariants } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

/**
 * DELETE /api/variants/:id — Delete a variant.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'delete-variant', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event }) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Variant ID required' })

    const db = useDatabase(event)

    await db.delete(promptElementVariants).where(eq(promptElementVariants.id, id))

    return { ok: true }
  },
)
