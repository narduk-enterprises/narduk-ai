import { defineStore } from 'pinia'
import type { Generation, GenerationQueryFilters } from '~/types/generation'

/**
 * useGenerationsStore — singleton state for the user's generation list.
 *
 * Uses Pinia for reactive state management.
 *
 * Responsibilities:
 *   - Owns the canonical `items` array (all pages loaded so far)
 *   - Tracks `lastSeenAt` ISO timestamp so the live poller can use `?since=`
 *   - Provides upsert/remove for optimistic updates after generate/delete
 *   - Provides applyDelta for merging since-poll results
 */
export const useGenerationsStore = defineStore('generations', () => {
  const items = ref<Generation[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const isFinished = ref(false)
  const lastSeenAt = ref(new Date(0).toISOString())

  // ── Helpers ──────────────────────────────────────────────────

  function advanceLastSeen(rows: Generation[]) {
    for (const row of rows) {
      if (row.updatedAt > lastSeenAt.value) {
        lastSeenAt.value = row.updatedAt
      }
    }
  }

  // ── Load (initial / filter-change) ───────────────────────────

  async function load(limit = 24, search?: string, filters?: GenerationQueryFilters) {
    loading.value = true
    isFinished.value = false
    try {
      const rows = await $fetch<Generation[]>('/api/generations', {
        query: {
          limit,
          search: search || undefined,
          type: filters?.type || undefined,
          mode: filters?.mode || undefined,
          status: filters?.status || undefined,
          sort: filters?.sort || undefined,
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

  async function loadMore(limit = 24, search?: string, filters?: GenerationQueryFilters) {
    if (loadingMore.value || isFinished.value) return
    loadingMore.value = true
    try {
      const rows = await $fetch<Generation[]>('/api/generations', {
        query: {
          limit,
          offset: items.value.length,
          search: search || undefined,
          type: filters?.type || undefined,
          mode: filters?.mode || undefined,
          status: filters?.status || undefined,
          sort: filters?.sort || undefined,
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
    if (gen.updatedAt > lastSeenAt.value) {
      lastSeenAt.value = gen.updatedAt
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

  const favorites = computed(() => items.value.filter((g) => g.isFavorite))

  /** Toggle favorite status with optimistic update */
  async function toggleFavorite(id: string) {
    // Optimistic toggle
    const idx = items.value.findIndex((g) => g.id === id)
    if (idx === -1) return
    const prev = items.value[idx]!.isFavorite
    items.value[idx]!.isFavorite = !prev
    try {
      const updated = await $fetch<Generation>(`/api/generations/${id}/favorite`, {
        method: 'PATCH',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      // Sync with server response
      items.value[idx]!.isFavorite = !!updated.isFavorite
    } catch {
      // Rollback on failure
      items.value[idx]!.isFavorite = prev
    }
  }

  return {
    items,
    loading,
    loadingMore,
    isFinished,
    lastSeenAt,
    doneImages,
    favorites,
    load,
    loadMore,
    applyDelta,
    upsert,
    remove,
    toggleFavorite,
  }
})
