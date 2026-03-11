import { quickModifiers } from '#server/database/schema'
import { eq } from 'drizzle-orm'
import { findDuplicates } from './dedup-modifiers.get'

/**
 * POST /api/admin/dedup-modifiers
 *
 * Applies deduplication — deletes duplicate quick_modifiers rows.
 * Keeps the row with the longer (richer) snippet.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'admin-dedup', 5, 60_000)

  const db = useDatabase(event)
  const rows = await db.select().from(quickModifiers).all()

  const { duplicates, idsToDelete } = findDuplicates(rows)

  if (idsToDelete.length > 0) {
    // Delete in batches to avoid SQLite limits
    const batchSize = 50
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize)
      const stmts = batch.map((id) => db.delete(quickModifiers).where(eq(quickModifiers.id, id)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- batch typing mismatch
      await db.batch(stmts as any)
    }
  }

  return {
    mode: 'applied',
    totalRows: rows.length,
    duplicateGroups: duplicates.length,
    rowsDeleted: idsToDelete.length,
    rowsAfterDedup: rows.length - idsToDelete.length,
    duplicates,
  }
})
