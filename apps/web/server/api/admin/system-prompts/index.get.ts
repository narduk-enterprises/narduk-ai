import { systemPrompts } from '#server/database/schema'
import { getAllSystemPrompts } from '#server/utils/systemPrompts'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDatabase(event)

  // Ensure defaults are populated first
  await getAllSystemPrompts(event)

  // Return the full table rows for the admin UI
  return await db.select().from(systemPrompts).orderBy(desc(systemPrompts.updatedAt)).all()
})
