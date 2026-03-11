/**
 * GET /api/admin/xai-usage — Fetches xAI API usage stats and billing info.
 *
 * Aggregates three xAI Management API calls:
 *   1. Prepaid credit balance
 *   2. Historical usage data
 *   3. Postpaid invoice preview (null if not on postpaid)
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig(event)
  const { xaiManagementKey, xaiTeamId } = config

  if (!xaiManagementKey || !xaiTeamId) {
    return {
      configured: false,
      balance: null,
      usage: null,
      invoicePreview: null,
    }
  }

  // Fetch all three endpoints in parallel — each individually tolerates failure
  const [balance, usage, invoicePreview] = await Promise.all([
    xaiGetPrepaidBalance(xaiManagementKey, xaiTeamId).catch((err) => {
      console.error('[xai-usage] balance fetch failed:', err.message)
      return null
    }),
    xaiGetUsage(xaiManagementKey, xaiTeamId).catch((err) => {
      console.error('[xai-usage] usage fetch failed:', err.message)
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
    usage,
    invoicePreview,
  }
})
