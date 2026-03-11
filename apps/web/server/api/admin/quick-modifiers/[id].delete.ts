import { eq } from 'drizzle-orm'
import { quickModifiers } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing modifier id' })
  }

  const db = useDatabase(event)
  await db.delete(quickModifiers).where(eq(quickModifiers.id, id)).execute()

  return { success: true }
})
