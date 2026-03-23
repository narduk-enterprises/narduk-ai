import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { generations } from '#server/database/schema'
import { defineAdminMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  reason: z.string().min(1).max(500).optional().default('Manually marked as failed by admin'),
})

/**
 * POST /api/admin/generations/[id]/fail — Force-fail a generation.
 * Admin-only. Marks a generation as failed with a custom reason.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'admin-generation-fail', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, body }) => {
    const log = useLogger(event).child('AdminGenerations')

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Missing generation ID' })

    const db = useAppDatabase(event)

    const gen = await db.select().from(generations).where(eq(generations.id, id)).get()
    if (!gen) throw createError({ statusCode: 404, message: 'Generation not found' })

    const now = new Date().toISOString()
    const errorMeta = JSON.stringify({
      error: {
        code: 'admin_action',
        message: body.reason,
      },
    })

    await db
      .update(generations)
      .set({ status: 'failed', metadata: errorMeta, updatedAt: now })
      .where(eq(generations.id, gen.id))

    log.warn('Admin force-failed generation', {
      generationId: id,
      reason: body.reason,
      previousStatus: gen.status,
    })

    const updated = await db.select().from(generations).where(eq(generations.id, id)).get()
    return updated
  },
)
