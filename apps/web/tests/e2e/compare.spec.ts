import {
  createUniqueEmail,
  expect,
  test,
  waitForBaseUrlReady,
  waitForHydration,
  warmUpApp,
} from './fixtures'

const testEmail = createUniqueEmail('compare-test')
const testPassword = 'testpass123'
const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zl7QAAAAASUVORK5CYII='

type UploadedImage = {
  id: string
}

let uploadedImages: UploadedImage[] = []

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
        body: JSON.stringify({ name: 'Compare Test User', email, password }),
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

async function ensureUploadedImages(page: import('@playwright/test').Page) {
  if (uploadedImages.length) {
    return uploadedImages
  }

  uploadedImages = await page.evaluate(
    async ({ imageBase64 }) => {
      const images = []

      for (let index = 0; index < 2; index += 1) {
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ imageBase64 }),
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${await response.text()}`)
        }

        images.push(await response.json())
      }

      return images
    },
    { imageBase64: tinyPngDataUrl },
  )

  return uploadedImages
}

test.describe.serial('compare flow', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('Compare tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('starts from a gallery card, stores a winner, and reorders rank view', async ({ page }) => {
    await registerAndLogin(page)
    const images = await ensureUploadedImages(page)

    await page.goto('/gallery')
    await waitForHydration(page)

    const firstCard = page.locator(`[data-generation-id="${images[0]!.id}"]`).first()
    await firstCard.hover()
    await firstCard.getByLabel('Compare gallery image').click()

    await expect(page).toHaveURL(new RegExp(`/compare\\?left=${images[0]!.id}`))
    await page.getByRole('button', { name: 'Choose Image B' }).click()
    await page.getByTestId(`compare-candidate-${images[1]!.id}`).click()
    await page.getByRole('button', { name: 'Pick Image A' }).click()

    await expect(page.getByText('now ranks above')).toBeVisible()

    await page.goto('/gallery?sort=rank')
    await waitForHydration(page)
    await expect(page.locator('[data-generation-id]').first()).toHaveAttribute(
      'data-generation-id',
      images[0]!.id,
    )
  })

  test('starts compare from the full-screen gallery viewer', async ({ page }) => {
    await registerAndLogin(page)
    const images = await ensureUploadedImages(page)

    await page.goto('/gallery')
    await waitForHydration(page)

    await page.locator(`[data-generation-id="${images[1]!.id}"]`).first().click()
    await page.getByLabel('Compare viewer image').click()

    await expect(page).toHaveURL(new RegExp(`/compare\\?left=${images[1]!.id}`))
  })

  test('starts compare from the generation detail page', async ({ page }) => {
    await registerAndLogin(page)
    const images = await ensureUploadedImages(page)

    await page.goto(`/gallery/${images[1]!.id}`)
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Compare this Image' }).click()

    await expect(page).toHaveURL(new RegExp(`/compare\\?left=${images[1]!.id}`))
  })

  test('starts compare from the recent carousel on generate', async ({ page }) => {
    await registerAndLogin(page)
    const images = await ensureUploadedImages(page)

    await page.goto('/generate')
    await waitForHydration(page)

    const recentItem = page.locator(`[data-generation-id="${images[0]!.id}"]`).first()
    await recentItem.hover()
    await recentItem.getByLabel('Compare recent image').click()

    await expect(page).toHaveURL(new RegExp(`/compare\\?left=${images[0]!.id}`))
  })
})
