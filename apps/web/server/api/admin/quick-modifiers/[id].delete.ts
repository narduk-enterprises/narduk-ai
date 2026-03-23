import { eq } from 'drizzle-orm'
import { quickModifiers } from '#server/database/schema'
import { defineAdminMutation } from '#layer/server/utils/mutation'

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-quick-modifier-delete', maxRequests: 20, windowMs: 60_000 },
  },
  async ({ event }) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing modifier id' })
    }

    const db = useDatabase(event)
    await db.delete(quickModifiers).where(eq(quickModifiers.id, id)).execute()

    return { success: true }
  },
)
