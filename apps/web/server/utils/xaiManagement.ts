/**
 * xAI Management API utilities.
 *
 * Uses the Management API at https://management-api.x.ai
 * which requires a separate management key (not the inference API key).
 *
 * @see https://docs.x.ai/docs/management-api
 */

const BASE_URL = 'https://management-api.x.ai'

function headers(managementKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${managementKey}`,
    'Content-Type': 'application/json',
  }
}

// ─── Response Types ─────────────────────────────────────────

export interface XaiBalanceChange {
  teamId: string
  changeOrigin: 'PURCHASE' | 'SPEND' | string
  topupStatus?: string
  amount: { val: string }
  invoiceId: string
  invoiceNumber: string
  createTime: string | null
  spendBpKeyYear?: number
  spendBpKeyMonth?: number
}

export interface XaiBalanceResponse {
  changes: XaiBalanceChange[]
  total: { val: string }
}

export interface XaiInvoiceLine {
  clusterName: string
  description: string
  unitType: string
  unitPrice: string
  numUnits: string
  amount: string
}

export interface XaiInvoicePreview {
  coreInvoice: {
    lines: XaiInvoiceLine[]
    totalWithCorr: { val: string }
    prepaidCredits: { val: string }
    prepaidCreditsUsed: { val: string }
  }
  billingCycle: { year: number; month: number }
}

// ─── API Calls ──────────────────────────────────────────────

/**
 * Fetch prepaid credit balance and recent balance changes.
 * GET /v1/billing/teams/{team_id}/prepaid/balance
 */
export async function xaiGetPrepaidBalance(
  managementKey: string,
  teamId: string,
): Promise<XaiBalanceResponse> {
  const res = await fetch(`${BASE_URL}/v1/billing/teams/${teamId}/prepaid/balance`, {
    method: 'GET',
    headers: headers(managementKey),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[xaiGetPrepaidBalance] API error (${res.status}):`, text)
    throw createError({ statusCode: res.status, message: 'Failed to fetch xAI prepaid balance.' })
  }

  return (await res.json()) as XaiBalanceResponse
}

/**
 * Fetch postpaid invoice preview for the current month.
 * GET /v1/billing/teams/{team_id}/postpaid/invoice/preview
 *
 * This contains full per-model, per-unit-type usage line items.
 */
export async function xaiGetInvoicePreview(
  managementKey: string,
  teamId: string,
): Promise<XaiInvoicePreview | null> {
  const res = await fetch(`${BASE_URL}/v1/billing/teams/${teamId}/postpaid/invoice/preview`, {
    method: 'GET',
    headers: headers(managementKey),
  })

  // Postpaid may not be configured — gracefully return null
  if (res.status === 404 || res.status === 400) {
    return null
  }

  if (!res.ok) {
    const text = await res.text()
    console.error(`[xaiGetInvoicePreview] API error (${res.status}):`, text)
    throw createError({
      statusCode: res.status,
      message: 'Failed to fetch xAI invoice preview.',
    })
  }

  return (await res.json()) as XaiInvoicePreview
}
