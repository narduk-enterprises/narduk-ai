import { eq, desc } from 'drizzle-orm'
import { promptElements } from '../../database/schema'
import { hydratePromptElementForRead } from '#server/utils/promptElementData'

/**
 * GET /api/elements — List user's prompt elements (newest first).
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('PromptElements')
  const user = await requireAuth(event)

  const db = useDatabase(event)

  const rows = await db
    .select()
    .from(promptElements)
    .where(eq(promptElements.userId, user.id))
    .orderBy(desc(promptElements.createdAt))

  log.debug('Prompt elements listed', { userId: user.id, count: rows.length })

  return rows.map((row) => hydratePromptElementForRead(row))
})
