import {
  createUniqueEmail,
  expect,
  test,
  waitForBaseUrlReady,
  waitForHydration,
  warmUpApp,
} from './fixtures'

/**
 * Integration tests for the AI generation API endpoints.
 *
 * Tests run serially because later tests depend on earlier ones
 * (I2I/I2V need a source image from T2I, list needs prior generations).
 *
 * Requires GROK_API_KEY to be configured (via Doppler) and dev server running.
 */
test.describe.serial('generation endpoints', () => {
  const testEmail = createUniqueEmail('gen-test')
  const testPassword = 'testpass123'

  // Track IDs across tests for chained operations
  let t2iGenerationId: string
  let t2vXaiRequestId: string

  /** Register a test user and authenticate the page context. */
  async function registerAndLogin(page: import('@playwright/test').Page) {
    await page.goto('/')
    await waitForHydration(page)

    await page.evaluate(
      async ({ email, password }) => {
        // Try register first
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ name: 'Gen Test User', email, password }),
        })
        if (regRes.ok) return

        // Already registered — login instead
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ email, password }),
        })
        if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
      },
      { email: testEmail, password: testPassword },
    )
  }

  /** Helper: make authenticated API call from page context. */
  async function apiCall(
    page: import('@playwright/test').Page,
    method: string,
    url: string,
    body?: Record<string, unknown>,
  ) {
    return page.evaluate(
      async ({ method, url, body }) => {
        const opts: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
        if (body) opts.body = JSON.stringify(body)
        const res = await fetch(url, opts)
        const text = await res.text()
        let data
        try {
          data = JSON.parse(text)
        } catch {
          data = text
        }
        return { status: res.status, data }
      },
      { method, url, body },
    )
  }

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('Generation tests require Playwright baseURL to be configured.')
    }
    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  // ─── Auth Guard ────────────────────────────────────────

  test('unauthenticated requests are rejected', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    const res = await apiCall(page, 'POST', '/api/generate/image', {
      prompt: 'test',
    })
    expect(res.status).toBe(401)
  })

  // ─── T2I: Text to Image ────────────────────────────────

  test('T2I: generates an image from text prompt', async ({ page }) => {
    test.setTimeout(60_000) // Image generation can take a while
    await registerAndLogin(page)

    const res = await apiCall(page, 'POST', '/api/generate/image', {
      prompt: 'A single red apple on a white background, product photo',
    })

    expect(res.status).toBe(200)
    expect(res.data.id).toBeTruthy()
    expect(res.data.type).toBe('image')
    expect(res.data.mode).toBe('t2i')
    expect(res.data.status).toBe('done')
    expect(res.data.r2Key).toContain('generations/')
    expect(res.data.mediaUrl).toContain('/api/media/')

    // Save for I2I and I2V tests
    t2iGenerationId = res.data.id
  })

  // ─── T2I: Validation ──────────────────────────────────

  test('T2I: rejects empty prompt', async ({ page }) => {
    await registerAndLogin(page)

    const res = await apiCall(page, 'POST', '/api/generate/image', {
      prompt: '',
    })
    expect(res.status).toBe(400)
  })

  // ─── T2V: Text to Video ────────────────────────────────

  test('T2V: starts video generation and returns pending status', async ({ page }) => {
    test.setTimeout(60_000)
    await registerAndLogin(page)

    const res = await apiCall(page, 'POST', '/api/generate/video', {
      prompt: 'A gentle ocean wave rolling onto a sandy beach',
      duration: 3,
      aspectRatio: '16:9',
      resolution: '480p',
    })

    expect(res.status).toBe(200)
    expect(res.data.id).toBeTruthy()
    expect(res.data.type).toBe('video')
    expect(res.data.mode).toBe('t2v')
    expect(res.data.status).toBe('pending')
    expect(res.data.xaiRequestId).toBeTruthy()

    // Save for poll test
    t2vXaiRequestId = res.data.xaiRequestId

    // Poll once to verify the endpoint works
    const pollRes = await apiCall(page, 'GET', `/api/generate/poll/${t2vXaiRequestId}`)
    expect(pollRes.status).toBe(200)
    expect(['pending', 'done', 'failed', 'expired']).toContain(pollRes.data.status)
  })

  // ─── Generations List ──────────────────────────────────

  test('list: returns user generations after T2I and T2V', async ({ page }) => {
    await registerAndLogin(page)

    const res = await apiCall(page, 'GET', '/api/generations')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThanOrEqual(2) // At least T2I + T2V
  })

  // ─── I2I: Image to Image ──────────────────────────────

  test('I2I: edits an existing image with a new prompt', async ({ page }) => {
    test.setTimeout(60_000)
    expect(t2iGenerationId).toBeTruthy()
    await registerAndLogin(page)

    const res = await apiCall(page, 'POST', '/api/generate/image-edit', {
      prompt: 'Make it look like a watercolor painting',
      sourceGenerationId: t2iGenerationId,
    })

    expect(res.status).toBe(200)
    expect(res.data.type).toBe('image')
    expect(res.data.mode).toBe('i2i')
    expect(res.data.status).toBe('done')
    expect(res.data.sourceGenerationId).toBe(t2iGenerationId)
    expect(res.data.r2Key).toContain('generations/')
  })

  // ─── I2V: Image to Video ──────────────────────────────

  test('I2V: starts video generation from an existing image', async ({ page }) => {
    test.setTimeout(60_000)
    expect(t2iGenerationId).toBeTruthy()
    await registerAndLogin(page)

    const res = await apiCall(page, 'POST', '/api/generate/video-from-image', {
      prompt: 'Slowly zoom into this image with gentle camera movement',
      sourceGenerationId: t2iGenerationId,
      duration: 3,
      resolution: '480p',
    })

    expect(res.status).toBe(200)
    expect(res.data.type).toBe('video')
    expect(res.data.mode).toBe('i2v')
    expect(res.data.status).toBe('pending')
    expect(res.data.sourceGenerationId).toBe(t2iGenerationId)
    expect(res.data.xaiRequestId).toBeTruthy()
  })

  // ─── Get Single & Delete ──────────────────────────────

  test('CRUD: get single generation and delete it', async ({ page }) => {
    await registerAndLogin(page)

    // Get the list
    const listRes = await apiCall(page, 'GET', '/api/generations')
    expect(listRes.data.length).toBeGreaterThan(0)

    // Pick the oldest to delete
    const gen = listRes.data.at(-1)

    // Get single
    const getRes = await apiCall(page, 'GET', `/api/generations/${gen.id}`)
    expect(getRes.status).toBe(200)
    expect(getRes.data.id).toBe(gen.id)

    // Delete it
    const delRes = await apiCall(page, 'DELETE', `/api/generations/${gen.id}`)
    expect(delRes.status).toBe(200)
    expect(delRes.data.deleted).toBe(true)

    // Verify deleted
    const verifyRes = await apiCall(page, 'GET', `/api/generations/${gen.id}`)
    expect(verifyRes.status).toBe(404)
  })
})
