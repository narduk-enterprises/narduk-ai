/**
 * Admin composable for spending overview.
 * Provides methods for fetching API usage and cost data.
 */
export function useAdminSpending() {
  interface SpendingData {
    totals: {
      generations: number
      images: number
      videos: number
      pending: number
      done: number
      failed: number
      expired: number
      estimatedCostUsd: number
    }
    byMode: Record<string, { count: number; costUsd: number }>
    daily: Array<{
      date: string
      count: number
      costUsd: number
      images: number
      videos: number
    }>
    topUsers: Array<{
      userId: string
      count: number
      costUsd: number
    }>
  }

  async function fetchSpending(): Promise<SpendingData> {
    return await $fetch<SpendingData>('/api/admin/spending')
  }

  return { fetchSpending }
}
