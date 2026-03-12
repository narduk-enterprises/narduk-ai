/**
 * useXaiModels — fetches the live xAI model catalog from the admin API.
 *
 * Results are cached in Nuxt's data layer for the session.
 * Call `refresh()` to force a re-fetch (busts the server-side per-isolate
 * cache too on next server boot, but returns fresh data immediately from xAI).
 */

interface XaiModelCatalog {
  imageModels: string[]
  videoModels: string[]
  chatModels: string[]
  fetchedAt: number
}

export function useXaiModels() {
  const { data, pending, refresh, error } = useAsyncData<XaiModelCatalog>('xai-models', () =>
    $fetch<XaiModelCatalog>('/api/admin/xai-models'),
  )

  const imageModels = computed(() => data.value?.imageModels ?? [])
  const videoModels = computed(() => data.value?.videoModels ?? [])
  const chatModels = computed(() => data.value?.chatModels ?? [])

  return { imageModels, videoModels, chatModels, pending, refresh, error }
}
