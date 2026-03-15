import { z } from 'zod'
import { promptElementVariants } from '../../database/schema'

const bodySchema = z.object({
  elementId: z.string().min(1),
  name: z.string().min(1).max(100),
  variantAttributes: z.record(z.string(), z.string()),
})

/**
 * POST /api/variants — Create a new variant for a prompt element.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  await enforceRateLimit(event, 'create-variant', 30, 60_000)

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
})
