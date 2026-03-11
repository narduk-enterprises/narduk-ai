/**
 * Admin composable for xAI API usage and billing stats.
 * Fetches aggregated data from /api/admin/xai-usage.
 */
export interface XaiUsageResponse {
  configured: boolean
  balance: Record<string, unknown> | null
  usage: Record<string, unknown> | null
  invoicePreview: Record<string, unknown> | null
}

export function useAdminXaiStats() {
  const { data, status, refresh, error } = useAsyncData<XaiUsageResponse>('admin-xai-usage', () =>
    $fetch<XaiUsageResponse>('/api/admin/xai-usage'),
  )

  return {
    data,
    status,
    refresh,
    error,
  }
}
