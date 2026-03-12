import type { Generation } from '../../app/types/generation'

import {
  createUniqueEmail,
  expect,
  test,
  waitForBaseUrlReady,
  waitForHydration,
  warmUpApp,
} from './fixtures'

const testEmail = createUniqueEmail('gallery-viewer')
const testPassword = 'testpass123'

function createGeneration(
  overrides: Partial<Generation> & Pick<Generation, 'id' | 'prompt'>,
): Generation {
  return {
    id: overrides.id,
    userId: overrides.userId ?? 'test-user',
    type: overrides.type ?? 'image',
    mode: overrides.mode ?? 't2i',
    prompt: overrides.prompt,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    status: overrides.status ?? 'done',
    xaiRequestId: overrides.xaiRequestId ?? null,
    r2Key: overrides.r2Key ?? null,
    mediaUrl: overrides.mediaUrl ?? '/presets/jessica_headshot_1773209387523.png',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    comparisonScore: overrides.comparisonScore ?? 0,
    comparisonWins: overrides.comparisonWins ?? 0,
    comparisonLosses: overrides.comparisonLosses ?? 0,
    lastComparedAt: overrides.lastComparedAt ?? null,
    duration: overrides.duration ?? null,
    generationTimeMs: overrides.generationTimeMs ?? 1200,
    aspectRatio: overrides.aspectRatio ?? '1:1',
    resolution: overrides.resolution ?? null,
    metadata: overrides.metadata ?? null,
    presets: overrides.presets ?? null,
    createdAt: overrides.createdAt ?? '2026-03-10T12:00:00.000Z',
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? '2026-03-10T12:00:00.000Z',
  }
}

async function registerAndLogin(page: import('@playwright/test').Page) {
  await page.goto('/')
  await waitForHydration(page)

  await page.evaluate(
    async ({ email, password }) => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }

      const register = await fetch('/api/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Gallery Viewer Test User', email, password }),
      })

      if (register.ok) {
        return
      }

      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
      })

      if (!login.ok) {
        throw new Error(`Login failed: ${await login.text()}`)
      }
    },
    { email: testEmail, password: testPassword },
  )
}

test.describe.serial('gallery viewer live updates', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('Gallery viewer tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('preserves the current image during poll refresh', async ({ page }) => {
    await registerAndLogin(page)

    const firstImage = createGeneration({
      id: 'gen-first',
      prompt: 'First gallery prompt',
      mediaUrl: '/presets/jessica_headshot_1773209387523.png',
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T10:00:00.000Z',
    })
    const secondImage = createGeneration({
      id: 'gen-second',
      prompt: 'Second gallery prompt',
      mediaUrl: '/presets/lola_headshot_1773209411743.png',
      createdAt: '2026-03-10T09:00:00.000Z',
      updatedAt: '2026-03-10T09:00:00.000Z',
    })
    const newestImage = createGeneration({
      id: 'gen-newest',
      prompt: 'Newest gallery prompt',
      mediaUrl: '/presets/emily_headshot_1773209437733.png',
      createdAt: '2026-03-11T12:00:00.000Z',
      updatedAt: '2026-03-11T12:00:00.000Z',
    })
    const refreshedSecondImage = createGeneration({
      ...secondImage,
      prompt: 'Second gallery prompt updated',
      updatedAt: '2026-03-11T12:05:00.000Z',
    })

    let sinceRequestCount = 0

    await page.route('**/api/generations**', async (route) => {
      const url = new URL(route.request().url())
      const since = url.searchParams.get('since')
      const offset = Number(url.searchParams.get('offset') ?? '0')

      let rows: Generation[] = []

      if (since) {
        sinceRequestCount += 1
        rows = sinceRequestCount === 1 ? [newestImage] : [refreshedSecondImage]
      } else if (offset > 0) {
        rows = []
      } else {
        rows = [firstImage, secondImage]
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      })
    })

    await page.goto('/gallery')
    await waitForHydration(page)

    await page.locator('[data-generation-id="gen-second"]').click()

    const viewer = page.locator('div.fixed.inset-0.z-50')
    await expect(
      viewer.getByRole('img', { name: 'Second gallery prompt', exact: true }),
    ).toBeVisible()

    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await expect(
      viewer.getByRole('img', { name: 'Second gallery prompt', exact: true }),
    ).toBeVisible()
    await expect(
      viewer.getByRole('img', { name: 'Newest gallery prompt', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('[data-generation-id="gen-newest"]')).toHaveCount(1)

    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await expect(
      viewer.getByRole('img', { name: 'Second gallery prompt updated', exact: true }),
    ).toBeVisible()
    await expect(
      viewer.getByRole('img', { name: 'Second gallery prompt', exact: true }),
    ).toHaveCount(0)
  })
})
