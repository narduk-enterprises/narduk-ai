import { quickModifiers } from '#server/database/schema'

/**
 * GET /api/admin/dedup-modifiers
 *
 * Dry-run only. Detects duplicate quick_modifiers rows that share the same
 * (attribute_key, LOWER(label)) but have different IDs.
 * Keeps the row with the longer (richer) snippet.
 *
 * To actually delete duplicates, POST to this endpoint.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDatabase(event)
  const rows = await db.select().from(quickModifiers).all()

  const { duplicates, idsToDelete } = findDuplicates(rows)

  return {
    mode: 'dry-run',
    totalRows: rows.length,
    duplicateGroups: duplicates.length,
    rowsToDelete: idsToDelete.length,
    rowsAfterDedup: rows.length - idsToDelete.length,
    duplicates,
  }
})

/** Shared dedup logic used by both GET and POST */
export function findDuplicates(
  rows: Array<{
    id: string
    category: string
    attributeKey: string | null
    label: string
    snippet: string
  }>,
) {
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${(row.attributeKey || row.category).toLowerCase()}::${row.label.toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const duplicates: Array<{
    attributeKey: string
    label: string
    keepId: string
    keepSnippet: string
    deleteId: string
    deleteSnippet: string
  }> = []

  const idsToDelete: string[] = []

  for (const [, group] of groups) {
    if (group.length <= 1) continue

    // Sort by snippet length descending — keep the longest (richest)
    group.sort((a, b) => b.snippet.length - a.snippet.length)
    const keep = group[0]!

    for (let i = 1; i < group.length; i++) {
      const dupe = group[i]!
      duplicates.push({
        attributeKey: keep.attributeKey || keep.category,
        label: keep.label,
        keepId: keep.id,
        keepSnippet: keep.snippet,
        deleteId: dupe.id,
        deleteSnippet: dupe.snippet,
      })
      idsToDelete.push(dupe.id)
    }
  }

  return { duplicates, idsToDelete }
}
