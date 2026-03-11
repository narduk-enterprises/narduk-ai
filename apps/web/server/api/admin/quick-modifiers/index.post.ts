import { z } from 'zod'
import { quickModifiers } from '../../../database/schema'

const bodySchema = z.object({
  id: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  snippet: z.string().min(1).max(500),
  sortOrder: z.number().int().min(0).default(0),
  enabled: z.number().int().min(0).max(1).default(1),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.issues.map((i) => i.message).join(', '),
    })
  }

  const db = useDatabase(event)
  const now = new Date().toISOString()

  await db
    .insert(quickModifiers)
    .values({ ...parsed.data, updatedAt: now })
    .execute()

  return { success: true, id: parsed.data.id }
})
