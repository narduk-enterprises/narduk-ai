import { expect, test, waitForBaseUrlReady, waitForHydration, warmUpApp } from './fixtures'

test.describe('web smoke', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('web smoke tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('home page renders the AI generation hero', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.getByText('Create with AI').first()).toBeVisible()
    await expect(page.getByText('Generate stunning images and videos').first()).toBeVisible()
    await expect(page).toHaveTitle(/AI Image/)
  })
})
