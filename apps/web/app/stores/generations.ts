import { defineStore } from 'pinia'
import type { Generation } from '~/types/generation'

/**
 * useGenerationsStore — single source of truth for the user's generation list.
 *
 * Responsibilities:
 *   - Owns the canonical `items` array (all pages loaded so far)
 *   - Tracks `lastSeenAt` ISO timestamp so live polling can use `?since=`
 *   - Provides upsert/remove for optimistic updates after generate/delete
 *   - Provides applyDelta for merging since-poll results
 */
export const useGenerationsStore = defineStore('generations', () => {
  const apiFetch = useRequestFetch()

  const items = ref<Generation[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const isFinished = ref(false)

  /**
   * ISO timestamp of the newest item we've seen — used as `since` for polling.
   * Stored in state so the poller always has the latest value.
   */
  const lastSeenAt = ref<string>(new Date(0).toISOString())

  // ── Helpers ──────────────────────────────────────────────────

  function advanceLastSeen(rows: Generation[]) {
    for (const row of rows) {
      if (row.createdAt > lastSeenAt.value) {
        lastSeenAt.value = row.createdAt
      }
    }
  }

  // ── Load (initial / filter-change) ───────────────────────────

  async function load(limit = 24, search?: string, filters?: { type?: string; mode?: string }) {
    loading.value = true
    isFinished.value = false
    try {
      const rows = await apiFetch<Generation[]>('/api/generations', {
        query: {
          limit,
          search: search || undefined,
          type: filters?.type || undefined,
          mode: filters?.mode || undefined,
        },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      items.value = rows
      if (rows.length < limit) isFinished.value = true
      advanceLastSeen(rows)
    } finally {
      loading.value = false
    }
  }

  // ── Load more (infinite scroll) ───────────────────────────────

  async function loadMore(limit = 24, search?: string, filters?: { type?: string; mode?: string }) {
    if (loadingMore.value || isFinished.value) return
    loadingMore.value = true
    try {
      const rows = await apiFetch<Generation[]>('/api/generations', {
        query: {
          limit,
          offset: items.value.length,
          search: search || undefined,
          type: filters?.type || undefined,
          mode: filters?.mode || undefined,
        },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (rows.length < limit) isFinished.value = true
      items.value.push(...rows)
      advanceLastSeen(rows)
    } catch {
      // silent — user can scroll again
    } finally {
      loadingMore.value = false
    }
  }

  // ── Delta merge (from since-poll) ─────────────────────────────

  /**
   * Merge rows returned by a `?since=` poll:
   *   - New rows are prepended to the list
   *   - Existing rows (pending→done transitions) are updated in place
   */
  function applyDelta(rows: Generation[]) {
    if (!rows.length) return
    for (const row of rows) {
      const idx = items.value.findIndex((g) => g.id === row.id)
      if (idx !== -1) {
        items.value[idx] = row
      } else {
        items.value.unshift(row)
      }
    }
    advanceLastSeen(rows)
  }

  // ── Optimistic upsert (post-generate) ────────────────────────

  /** Prepend if new, update if existing. Used by useGenerationDispatch. */
  function upsert(gen: Generation) {
    const idx = items.value.findIndex((g) => g.id === gen.id)
    if (idx !== -1) {
      items.value[idx] = gen
    } else {
      items.value.unshift(gen)
    }
    if (gen.createdAt > lastSeenAt.value) {
      lastSeenAt.value = gen.createdAt
    }
  }

  // ── Remove ───────────────────────────────────────────────────

  function remove(id: string) {
    items.value = items.value.filter((g) => g.id !== id)
  }

  // ── Derived ──────────────────────────────────────────────────

  const doneImages = computed(() =>
    items.value.filter((g) => g.type === 'image' && g.status === 'done'),
  )

  return {
    items,
    loading,
    loadingMore,
    isFinished,
    lastSeenAt,
    doneImages,
    load,
    loadMore,
    applyDelta,
    upsert,
    remove,
  }
})
