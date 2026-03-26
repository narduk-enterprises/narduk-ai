import { eq, desc, or } from 'drizzle-orm'
import { promptTemplates } from '#server/database/schema'

type PromptTemplateRow = typeof promptTemplates.$inferSelect

/**
 * GET /api/templates — List available templates (system + user's own).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDatabase(event)

  const rows: PromptTemplateRow[] = await db
    .select()
    .from(promptTemplates)
    .where(or(eq(promptTemplates.isSystem, 1), eq(promptTemplates.userId, user.id)))
    .orderBy(desc(promptTemplates.isSystem), promptTemplates.sortOrder)

  return rows.map((row) => ({
    ...row,
    slots: JSON.parse(row.slots) as string[],
  }))
})
