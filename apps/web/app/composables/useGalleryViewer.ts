import type { Generation } from '~/types/generation'

/**
 * Composable for the full-page gallery viewer.
 * Manages viewer state, wrap-around navigation, and infinite scroll prefetch.
 */
export function useGalleryViewer() {
  const isOpen = useState('gallery-viewer-open', () => false)
  const items = useState<Generation[]>('gallery-viewer-items', () => [])
  const currentIndex = useState('gallery-viewer-index', () => 0)

  // Store the loadMore callback in a non-serializable ref (not useState)
  const loadMoreCallback = ref<(() => Promise<void>) | null>(null)
  const loadingMore = ref(false)

  const currentItem = computed(() => items.value[currentIndex.value] ?? null)

  // Navigation always wraps around when there are 2+ items
  const hasNext = computed(() => items.value.length > 1)
  const hasPrev = computed(() => items.value.length > 1)

  // Whether more items can potentially be loaded from the server
  const canLoadMore = computed(() => !!loadMoreCallback.value)

  const counter = computed(() => {
    const suffix = canLoadMore.value ? '+' : ''
    return `${currentIndex.value + 1} / ${items.value.length}${suffix}`
  })

  function open(list: Generation[], index: number, loadMoreFn?: () => Promise<void>) {
    items.value = [...list]
    currentIndex.value = Math.max(0, Math.min(index, list.length - 1))
    loadMoreCallback.value = loadMoreFn ?? null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  async function next() {
    if (items.value.length <= 1) return

    // Near the end — try to prefetch before advancing
    if (currentIndex.value >= items.value.length - 4) {
      await maybePrefetch()
    }

    if (currentIndex.value < items.value.length - 1) {
      currentIndex.value++
    } else {
      // Wrap to first item
      currentIndex.value = 0
    }
  }

  function prev() {
    if (items.value.length <= 1) return

    if (currentIndex.value > 0) {
      currentIndex.value--
    } else {
      // Wrap to last item
      currentIndex.value = items.value.length - 1
    }
  }

  async function goTo(index: number) {
    if (index >= 0 && index < items.value.length) {
      currentIndex.value = index
      await maybePrefetch()
    }
  }

  /** Update the items list (e.g. after parent loads more data) */
  function updateItems(newItems: Generation[]) {
    const activeItemId = currentItem.value?.id ?? null
    items.value = [...newItems]

    if (!newItems.length) {
      currentIndex.value = 0
      close()
      return
    }

    if (activeItemId) {
      const nextIndex = newItems.findIndex((item) => item.id === activeItemId)
      if (nextIndex !== -1) {
        currentIndex.value = nextIndex
        return
      }
    }

    currentIndex.value = Math.max(0, Math.min(currentIndex.value, newItems.length - 1))
  }

  /** Prefetch more items when near the end of the list */
  async function maybePrefetch() {
    if (
      loadMoreCallback.value &&
      !loadingMore.value &&
      currentIndex.value >= items.value.length - 4
    ) {
      loadingMore.value = true
      try {
        await loadMoreCallback.value()
      } finally {
        loadingMore.value = false
      }
    }
  }

  return {
    isOpen,
    items,
    currentIndex,
    currentItem,
    hasNext,
    hasPrev,
    canLoadMore,
    counter,
    loadingMore,
    open,
    close,
    next,
    prev,
    goTo,
    updateItems,
  }
}
