import { eq, like } from 'drizzle-orm'
import { generations } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'

/**
 * GET /api/admin/seed-batches — List all seed batches with summary stats.
 *
 * Scans generations metadata for batchId entries and returns distinct batches
 * with their label, dimension, generation count, and creation date.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useAppDatabase(event)

  // Find all generations that have batchId in metadata
  const rows = await db
    .select({
      id: generations.id,
      metadata: generations.metadata,
      createdAt: generations.createdAt,
      mediaUrl: generations.mediaUrl,
    })
    .from(generations)
    .where(like(generations.metadata, '%batchId%'))
    .all()

  // Group by batchId
  const batchMap = new Map<string, {
    batchId: string
    label: string | null
    dimension: string
    count: number
    createdAt: string
    previewUrl: string | null
  }>()

  for (const row of rows) {
    if (!row.metadata) continue

    try {
      const meta = JSON.parse(row.metadata) as Record<string, unknown>
      const batchId = meta.batchId as string
      if (!batchId) continue

      const existing = batchMap.get(batchId)
      if (existing) {
        existing.count++
      }
      else {
        batchMap.set(batchId, {
          batchId,
          label: (meta.batchLabel as string) || null,
          dimension: (meta.batchDimension as string) || 'unknown',
          count: 1,
          createdAt: row.createdAt,
          previewUrl: row.mediaUrl,
        })
      }
    }
    catch {
      // skip invalid metadata
    }
  }

  // Sort newest first
  return Array.from(batchMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})
