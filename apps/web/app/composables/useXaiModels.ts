import type { XaiModelCatalog } from '~/utils/xaiModels'

/**
 * useXaiModels — fetches the live xAI model catalog from the admin API.
 *
 * Results are cached in Nuxt's data layer for the session.
 * Call `refresh()` to force a re-fetch (busts the server-side per-isolate
 * cache too on next server boot, but returns fresh data immediately from xAI).
 */

interface XaiModelCatalogResponse extends XaiModelCatalog {
  fetchedAt: number
}

export function useXaiModels() {
  const { data, pending, refresh, error } = useAsyncData<XaiModelCatalogResponse>(
    'xai-models',
    () => {
      const headers = import.meta.server
        ? (useRequestHeaders(['cookie']) as Record<string, string>)
        : undefined
      return $fetch<XaiModelCatalogResponse>('/api/models', {
        ...(headers && { headers }),
      })
    },
  )

  const imageModels = computed(() => data.value?.imageModels ?? [])
  const videoModels = computed(() => data.value?.videoModels ?? [])
  const chatModels = computed(() => data.value?.chatModels ?? [])
  const visionModels = computed(() => data.value?.visionModels ?? [])
  const preferredImageModel = computed(() => data.value?.preferredImageModel ?? null)
  const preferredVideoModel = computed(() => data.value?.preferredVideoModel ?? null)
  const preferredChatModel = computed(() => data.value?.preferredChatModel ?? null)
  const preferredVisionModel = computed(() => data.value?.preferredVisionModel ?? null)

  return {
    imageModels,
    videoModels,
    chatModels,
    visionModels,
    preferredImageModel,
    preferredVideoModel,
    preferredChatModel,
    preferredVisionModel,
    pending,
    refresh,
    error,
  }
}
