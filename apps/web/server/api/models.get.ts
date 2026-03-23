/**
 * GET /api/models — Live xAI model catalog.
 *
 * Fetches the model list from xAI's /v1/models endpoint and splits
 * into image / video / chat buckets by ID prefix convention.
 *
 * Results are cached per-isolate for 1 hour so the admin settings page
 * doesn't hit xAI on every render. Cache is best-effort (per V8 isolate).
 */

import { xaiImagineListModels } from '#server/utils/grok'
import { buildXaiModelCatalog, type XaiModelCatalog } from '~/utils/xaiModels'

interface ModelCache extends XaiModelCatalog {
  fetchedAt: number
}

const TTL_MS = 60 * 60 * 1000 // 1 hour
let cachedResult: ModelCache | null = null

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const config = useRuntimeConfig(event)
  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'XAI_API_KEY is not configured.' })
  }

  // Return cached result if still fresh
  if (cachedResult && Date.now() - cachedResult.fetchedAt < TTL_MS) {
    return cachedResult
  }

  const models = await xaiImagineListModels(config.xaiApiKey)
  const catalog = buildXaiModelCatalog(models.map((m) => m.id))
  cachedResult = { ...catalog, fetchedAt: Date.now() }
  return cachedResult
})
