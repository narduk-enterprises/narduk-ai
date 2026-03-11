// eslint-disable-next-line import-x/named -- Wait for playwright types fix
import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * Hydration Smoke Tests
 *
 * Visits every known route and asserts that no Vue/Nuxt hydration
 * warnings or errors appear in the browser console.
 *
 * Public pages are tested for content.
 * Auth-protected pages will redirect to login — we still verify
 * that the redirect itself doesn't produce hydration errors.
 */

const HYDRATION_PATTERNS = [
  'Hydration',
  'hydration mismatch',
  'mismatch',
  'Hydration node mismatch',
  'Hydration text content mismatch',
  'Hydration children mismatch',
  'An error occurred during hydration',
  'There was an error while hydrating',
]

function isHydrationError(msg: ConsoleMessage): boolean {
  const text = msg.text()
  const type = msg.type()
  if (type !== 'warning' && type !== 'error') return false
  return HYDRATION_PATTERNS.some((p) => text.includes(p))
}

/** Pages that do NOT require authentication */
const PUBLIC_PAGES = [{ path: '/', name: 'Home' }]

/** Pages that require auth (will redirect, but SSR still runs) */
const AUTH_PAGES = [
  { path: '/generate', name: 'Generate' },
  { path: '/chat', name: 'Chat' },
  { path: '/gallery', name: 'Gallery' },
  { path: '/settings', name: 'Settings' },
]

const ADMIN_PAGES = [
  { path: '/admin', name: 'Admin Dashboard' },
  { path: '/admin/generations', name: 'Admin Generations' },
  { path: '/admin/settings', name: 'Admin Settings' },
]

const ALL_PAGES = [...PUBLIC_PAGES, ...AUTH_PAGES, ...ADMIN_PAGES]

for (const { path, name } of ALL_PAGES) {
  test(`[Hydration] ${name} (${path}) — no hydration errors`, async ({ page }) => {
    const hydrationErrors: string[] = []

    page.on('console', (msg) => {
      if (isHydrationError(msg)) {
        hydrationErrors.push(`[${msg.type()}] ${msg.text()}`)
      }
    })

    page.on('pageerror', (err) => {
      if (HYDRATION_PATTERNS.some((p) => err.message.includes(p))) {
        hydrationErrors.push(`[pageerror] ${err.message}`)
      }
    })

    const response = await page.goto(path, { waitUntil: 'networkidle' })

    // Page should respond (200 or redirect)
    expect(response?.status()).toBeLessThan(500)

    // Wait a beat for any delayed hydration warnings
    await page.waitForTimeout(1000)

    expect(hydrationErrors, `Hydration errors found on ${path}`).toEqual([])
  })
}

// Extra: verify public homepage renders meaningful content
test('[Smoke] Home page renders content', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)

  // Page should have some visible text
  const body = await page.textContent('body')
  expect(body?.length).toBeGreaterThan(50)
})
