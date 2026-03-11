import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { systemPrompts } from '../../../database/schema'

const bodySchema = z.object({
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminSystemPrompts')
  const user = await requireAdmin(event)
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({ statusCode: 400, message: 'Missing system prompt name' })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDatabase(event)
  const now = new Date().toISOString()

  await db
    .update(systemPrompts)
    .set({ content: body.content, updatedAt: now })
    .where(eq(systemPrompts.name, name))
    .execute()

  log.info(`System prompt '${name}' updated`, { userId: user.id })

  return { success: true }
})
