import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { quickModifiers } from '../../../database/schema'

const bodySchema = z.object({
  category: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
  snippet: z.string().min(1).max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  enabled: z.number().int().min(0).max(1).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing modifier id' })
  }

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

  const updates: Record<string, unknown> = { updatedAt: now }
  if (parsed.data.category !== undefined) updates.category = parsed.data.category
  if (parsed.data.label !== undefined) updates.label = parsed.data.label
  if (parsed.data.snippet !== undefined) updates.snippet = parsed.data.snippet
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled

  await db.update(quickModifiers).set(updates).where(eq(quickModifiers.id, id)).execute()

  return { success: true }
})
