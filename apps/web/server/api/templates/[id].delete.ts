import { eq, and } from 'drizzle-orm'
import { promptTemplates } from '../../database/schema'

/**
 * DELETE /api/templates/:id — Delete a user's custom template.
 * System templates cannot be deleted.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Template ID required' })

  const db = useDatabase(event)

  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1)

  if (!template) throw createError({ statusCode: 404, message: 'Template not found' })
  if (template.isSystem)
    throw createError({ statusCode: 403, message: 'Cannot delete system templates' })
  if (template.userId !== user.id)
    throw createError({ statusCode: 403, message: 'Not your template' })

  await db
    .delete(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, user.id)))

  return { ok: true }
})
