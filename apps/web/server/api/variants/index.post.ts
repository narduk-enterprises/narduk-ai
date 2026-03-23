import { z } from 'zod'
import { promptElementVariants } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  elementId: z.string().min(1),
  name: z.string().min(1).max(100),
  variantAttributes: z.record(z.string(), z.string()),
})

/**
 * POST /api/variants — Create a new variant for a prompt element.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'create-variant', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event }) => {
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDatabase(event)

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const variant = {
      id,
      elementId: body.elementId,
      name: body.name,
      variantAttributes: JSON.stringify(body.variantAttributes),
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(promptElementVariants).values(variant)

    return { ...variant, variantAttributes: body.variantAttributes }
  },
)
