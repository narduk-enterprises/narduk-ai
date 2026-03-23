import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { quickModifiers } from '#server/database/schema'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  category: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
  snippet: z.string().min(1).max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  enabled: z.number().int().min(0).max(1).optional(),
})

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-quick-modifier-update', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, body }) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing modifier id' })
    }

    const db = useAppDatabase(event)
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = { updatedAt: now }
    if (body.category !== undefined) updates.category = body.category
    if (body.label !== undefined) updates.label = body.label
    if (body.snippet !== undefined) updates.snippet = body.snippet
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder
    if (body.enabled !== undefined) updates.enabled = body.enabled

    await db.update(quickModifiers).set(updates).where(eq(quickModifiers.id, id)).execute()

    return { success: true }
  },
)
