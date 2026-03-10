import { desc } from 'drizzle-orm'
import { generations } from '../../../database/schema'

/**
 * GET /api/admin/spending — Aggregated spending overview (admin only).
 * Returns generation counts, estimated costs, and daily breakdown.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('AdminSpending')
  await requireAdmin(event)

  const db = useDatabase(event)

  // Fetch all generations (most recent first, reasonable limit)
  const rows = await db
    .select()
    .from(generations)
    .orderBy(desc(generations.createdAt))
    .limit(5000)

  // ─── Aggregate Stats ───────────────────────────────────────
  const totals = {
    generations: rows.length,
    images: 0,
    videos: 0,
    pending: 0,
    done: 0,
    failed: 0,
    expired: 0,
    estimatedCostUsd: 0,
  }

  const byMode: Record<string, { count: number; costUsd: number }> = {}
  const byUser: Record<string, { count: number; costUsd: number }> = {}
  const dailyMap: Record<string, { count: number; costUsd: number; images: number; videos: number }> =
    {}

  for (const gen of rows) {
    // Type counts
    if (gen.type === 'image') totals.images++
    else totals.videos++

    // Status counts
    if (gen.status === 'done') totals.done++
    else if (gen.status === 'pending') totals.pending++
    else if (gen.status === 'failed') totals.failed++
    else if (gen.status === 'expired') totals.expired++

    // Estimated cost — try metadata first, fall back to computed estimate
    let costUsd = 0
    if (gen.metadata) {
      try {
        const meta = JSON.parse(gen.metadata)
        if (typeof meta.estimatedCostUsd === 'number') {
          costUsd = meta.estimatedCostUsd
        }
      } catch {
        // ignore parse errors
      }
    }
    if (costUsd === 0) {
      costUsd = estimateGenerationCost({
        type: gen.type as 'image' | 'video',
        duration: gen.duration,
      })
    }

    totals.estimatedCostUsd += costUsd

    // By mode
    const mode = gen.mode || 'unknown'
    if (!byMode[mode]) byMode[mode] = { count: 0, costUsd: 0 }
    byMode[mode].count++
    byMode[mode].costUsd += costUsd

    // By user (truncated ID for privacy)
    const userId = gen.userId
    if (!byUser[userId]) byUser[userId] = { count: 0, costUsd: 0 }
    byUser[userId].count++
    byUser[userId].costUsd += costUsd

    // Daily breakdown
    const day = gen.createdAt.slice(0, 10) // 'YYYY-MM-DD'
    if (!dailyMap[day]) dailyMap[day] = { count: 0, costUsd: 0, images: 0, videos: 0 }
    dailyMap[day].count++
    dailyMap[day].costUsd += costUsd
    if (gen.type === 'image') dailyMap[day].images++
    else dailyMap[day].videos++
  }

  // Convert daily map to sorted array (most recent first)
  const daily = Object.entries(dailyMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date))

  // Convert by-user to sorted array (highest spend first), truncate IDs
  const topUsers = Object.entries(byUser)
    .map(([userId, stats]) => ({
      userId: `${userId.slice(0, 8)}…`,
      ...stats,
      costUsd: Math.round(stats.costUsd * 100) / 100,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 20)

  // Round costs for display
  totals.estimatedCostUsd = Math.round(totals.estimatedCostUsd * 100) / 100
  for (const mode of Object.keys(byMode)) {
    byMode[mode].costUsd = Math.round(byMode[mode].costUsd * 100) / 100
  }
  for (const d of daily) {
    d.costUsd = Math.round(d.costUsd * 100) / 100
  }

  log.info('Admin spending overview', { totalGenerations: totals.generations })

  return {
    totals,
    byMode,
    daily: daily.slice(0, 30), // Last 30 days with data
    topUsers,
  }
})
