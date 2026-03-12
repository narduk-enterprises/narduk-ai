import type { Generation } from '~/types/generation'

/**
 * useGalleryPoller — always-on since-based gallery poller.
 *
 * - Polls `GET /api/generations?since=<lastSeenAt>` every 15 seconds
 * - Pauses when the tab is hidden (saves compute + battery)
 * - Fires immediately when the tab becomes visible again
 * - Never auto-stops — runs the entire time the consuming page is mounted
 *
 * The store handles all merging via `applyDelta`.
 */
export function useGalleryPoller(intervalMs = 15_000) {
  const store = useGenerationsStore()
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false

  async function poll() {
    if (running) return
    running = true
    try {
      const rows = await $fetch<Generation[]>('/api/generations', {
        query: { since: store.lastSeenAt.value },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      store.applyDelta(rows)
    } catch {
      // silent — next tick will retry
    } finally {
      running = false
    }
    schedulNext()
  }

  function schedulNext() {
    if (document.hidden) return // will re-arm on visibilitychange
    timer = setTimeout(poll, intervalMs)
  }

  function onVisibilityChange() {
    if (!document.hidden) {
      // Tab became visible — fire immediately then resume schedule
      if (timer) clearTimeout(timer)
      poll()
    } else {
      // Tab hidden — cancel next scheduled tick
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    schedulNext()
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })
}
