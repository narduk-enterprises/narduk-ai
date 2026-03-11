/**
 * Admin composable for xAI API usage and billing stats.
 * Fetches aggregated data from /api/admin/xai-usage.
 */

interface XaiBalanceChange {
  changeOrigin: string
  amount: { val: string }
  invoiceNumber: string
  createTime: string | null
  spendBpKeyYear?: number
  spendBpKeyMonth?: number
}

interface XaiInvoiceLine {
  description: string
  unitType: string
  unitPrice: string
  numUnits: string
  amount: string
}

export interface XaiUsageResponse {
  configured: boolean
  balance: {
    changes: XaiBalanceChange[]
    total: { val: string }
  } | null
  invoicePreview: {
    coreInvoice: {
      lines: XaiInvoiceLine[]
      totalWithCorr: { val: string }
      prepaidCredits: { val: string }
      prepaidCreditsUsed: { val: string }
    }
    billingCycle: { year: number; month: number }
  } | null
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
