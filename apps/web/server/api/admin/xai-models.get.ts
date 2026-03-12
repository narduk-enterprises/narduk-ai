/**
 * GET /api/admin/xai-models — Live xAI model catalog (admin-only).
 *
 * Fetches the model list from xAI's /v1/models endpoint and splits
 * into image / video / chat buckets by ID prefix convention.
 *
 * Results are cached per-isolate for 1 hour so the admin settings page
 * doesn't hit xAI on every render. Cache is best-effort (per V8 isolate).
 */

interface ModelCache {
  imageModels: string[]
  videoModels: string[]
  chatModels: string[]
  fetchedAt: number
}

const TTL_MS = 60 * 60 * 1000 // 1 hour
let cachedResult: ModelCache | null = null

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig(event)
  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'XAI_API_KEY is not configured.' })
  }

  // Return cached result if still fresh
  if (cachedResult && Date.now() - cachedResult.fetchedAt < TTL_MS) {
    return cachedResult
  }

  const models = await grokListModels(config.xaiApiKey)
  const ids = models.map((m) => m.id).sort()

  const imageModels = ids.filter((id) => id.includes('image') || id.includes('imagine-image'))
  const videoModels = ids.filter((id) => id.includes('video') || id.includes('imagine-video'))
  const chatModels = ids.filter(
    (id) => !imageModels.includes(id) && !videoModels.includes(id) && !id.includes('imagine'),
  )

  cachedResult = { imageModels, videoModels, chatModels, fetchedAt: Date.now() }
  return cachedResult
})
