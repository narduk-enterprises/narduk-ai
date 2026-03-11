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

/**
 * Fetch prepaid credit balance and recent balance changes.
 * GET /v1/billing/teams/{team_id}/prepaid/balance
 */
export async function xaiGetPrepaidBalance(
  managementKey: string,
  teamId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/v1/billing/teams/${teamId}/prepaid/balance`, {
    method: 'GET',
    headers: headers(managementKey),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[xaiGetPrepaidBalance] API error (${res.status}):`, text)
    throw createError({ statusCode: res.status, message: 'Failed to fetch xAI prepaid balance.' })
  }

  return (await res.json()) as Record<string, unknown>
}

/**
 * Fetch historical API usage data.
 * POST /v1/billing/teams/{team_id}/usage
 */
export async function xaiGetUsage(
  managementKey: string,
  teamId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/v1/billing/teams/${teamId}/usage`, {
    method: 'POST',
    headers: headers(managementKey),
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[xaiGetUsage] API error (${res.status}):`, text)
    throw createError({ statusCode: res.status, message: 'Failed to fetch xAI usage data.' })
  }

  return (await res.json()) as Record<string, unknown>
}

/**
 * Fetch postpaid invoice preview for the current month.
 * GET /v1/billing/teams/{team_id}/postpaid/invoice/preview
 */
export async function xaiGetInvoicePreview(
  managementKey: string,
  teamId: string,
): Promise<Record<string, unknown> | null> {
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

  return (await res.json()) as Record<string, unknown>
}
