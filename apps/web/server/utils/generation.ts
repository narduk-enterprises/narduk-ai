/**
 * Shared constants and helpers for generation lifecycle management.
 * Centralises the stale-timeout value used in poll, list, get, cron, and admin routes.
 */

/** Maximum age (ms) a pending generation may stay pending before it is auto-failed. */
export const STALE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

/** Standard metadata stored when a generation times out. */
export const TIMEOUT_ERROR_META = JSON.stringify({
  error: {
    code: 'timeout',
    message: 'Generation timed out after 10 minutes. The API did not return a result in time.',
  },
})

/** Returns true if the generation's `createdAt` age exceeds STALE_TIMEOUT_MS. */
export function isGenerationStale(createdAt: string): boolean {
  const ts = new Date(createdAt).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts > STALE_TIMEOUT_MS
}
