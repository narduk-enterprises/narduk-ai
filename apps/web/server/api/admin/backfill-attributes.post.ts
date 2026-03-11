import { eq, isNull } from 'drizzle-orm'
import { promptElements } from '../../database/schema'

/**
 * POST /api/admin/backfill-attributes — Backfill attributes JSON from content text.
 * Admin-only endpoint. Parses existing "Key: value" content lines into structured JSON.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('BackfillAttributes')
  await requireAdmin(event)
  await enforceRateLimit(event, 'backfill-attributes', 5, 60_000)

  const db = useDatabase(event)

  // Find all elements missing attributes
  const elements = await db
    .select({
      id: promptElements.id,
      content: promptElements.content,
    })
    .from(promptElements)
    .where(isNull(promptElements.attributes))
    .all()

  if (elements.length === 0) {
    return { updated: 0, message: 'No elements need backfilling' }
  }

  let updated = 0
  const errors: string[] = []

  for (const el of elements) {
    try {
      // Parse "Key: value" content lines into structured JSON
      const attrs: Record<string, string> = {}
      for (const line of el.content.split('\n')) {
        const idx = line.indexOf(':')
        if (idx > 0) {
          const key = line.slice(0, idx).trim().toLowerCase().replaceAll(' ', '_')
          const val = line.slice(idx + 1).trim()
          if (val) attrs[key] = val
        }
      }

      if (Object.keys(attrs).length > 0) {
        await db
          .update(promptElements)
          .set({
            attributes: JSON.stringify(attrs),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(promptElements.id, el.id))
        updated++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${el.id}: ${msg}`)
    }
  }

  log.info('Backfill complete', { total: elements.length, updated, errors: errors.length })

  return {
    total: elements.length,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  }
})
