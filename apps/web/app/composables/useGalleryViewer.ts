import type { Generation } from '~/types/generation'

/**
 * Composable for the full-page gallery viewer.
 * Manages viewer state, keyboard/swipe navigation, and infinite scroll prefetch.
 */
export function useGalleryViewer() {
  const isOpen = useState('gallery-viewer-open', () => false)
  const items = useState<Generation[]>('gallery-viewer-items', () => [])
  const currentIndex = useState('gallery-viewer-index', () => 0)

  // Store the loadMore callback in a non-serializable ref (not useState)
  const loadMoreCallback = ref<(() => Promise<void>) | null>(null)
  const loadingMore = ref(false)

  const currentItem = computed(() => items.value[currentIndex.value] ?? null)
  const hasNext = computed(() => currentIndex.value < items.value.length - 1)
  const hasPrev = computed(() => currentIndex.value > 0)
  const counter = computed(() => `${currentIndex.value + 1} / ${items.value.length}`)

  function open(list: Generation[], index: number, loadMoreFn?: () => Promise<void>) {
    items.value = [...list]
    currentIndex.value = Math.max(0, Math.min(index, list.length - 1))
    loadMoreCallback.value = loadMoreFn ?? null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function next() {
    if (hasNext.value) {
      currentIndex.value++
      maybePrefetch()
    }
  }

  function prev() {
    if (hasPrev.value) {
      currentIndex.value--
    }
  }

  function goTo(index: number) {
    if (index >= 0 && index < items.value.length) {
      currentIndex.value = index
      maybePrefetch()
    }
  }

  /** Update the items list (e.g. after parent loads more data) */
  function updateItems(newItems: Generation[]) {
    items.value = [...newItems]
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
