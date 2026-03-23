import { z } from 'zod'
import { quickModifiers } from '#server/database/schema'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  id: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  snippet: z.string().min(1).max(500),
  sortOrder: z.number().int().min(0).default(0),
  enabled: z.number().int().min(0).max(1).default(1),
})

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-quick-modifier-create', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, body }) => {
    const db = useAppDatabase(event)
    const now = new Date().toISOString()

    await db
      .insert(quickModifiers)
      .values({ ...body, updatedAt: now })
      .execute()

    return { success: true, id: body.id }
  },
)
