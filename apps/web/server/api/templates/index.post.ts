import { z } from 'zod'
import { promptTemplates } from '#server/database/schema'
import { defineUserMutation } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  category: z
    .enum(['portrait', 'environmental', 'cinematic', 'video', 'duo', 'general'])
    .default('general'),
  pattern: z.string().min(1).max(2000),
  slots: z.array(z.string()).min(1).max(10),
})

/**
 * POST /api/templates — Create a custom user template.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'create-template', maxRequests: 20, windowMs: 60_000 },
  },
  async ({ event, user }) => {
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDatabase(event)

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const template = {
      id,
      userId: user.id,
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      pattern: body.pattern,
      slots: JSON.stringify(body.slots),
      isSystem: 0,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(promptTemplates).values(template)

    return { ...template, slots: body.slots }
  },
)
