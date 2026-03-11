import type { XaiBalanceResponse, XaiInvoicePreview } from '#server/utils/xaiManagement'

/**
 * GET /api/admin/xai-usage — Fetches xAI API usage stats and billing info.
 *
 * Aggregates two xAI Management API calls:
 *   1. Prepaid credit balance + balance change history
 *   2. Current-month invoice preview (contains per-model usage line items)
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig(event)
  const { xaiManagementKey, xaiTeamId } = config

  if (!xaiManagementKey || !xaiTeamId) {
    return {
      configured: false,
      balance: null as XaiBalanceResponse | null,
      invoicePreview: null as XaiInvoicePreview | null,
    }
  }

  const [balance, invoicePreview] = await Promise.all([
    xaiGetPrepaidBalance(xaiManagementKey, xaiTeamId).catch((err) => {
      console.error('[xai-usage] balance fetch failed:', err.message)
      return null
    }),
    xaiGetInvoicePreview(xaiManagementKey, xaiTeamId).catch((err) => {
      console.error('[xai-usage] invoice preview fetch failed:', err.message)
      return null
    }),
  ])

  return {
    configured: true,
    balance,
    invoicePreview,
  }
})
