<script setup lang="ts">
import type { GenerationQueryFilters } from '~/types/generation'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Gallery — Narduk AI',
  description: 'Browse your AI-generated images and videos.',
})
useWebPageSchema({
  name: 'Gallery — Narduk AI',
  description: 'Browse your AI-generated images and videos.',
})

const store = useGenerationsStore()
const galleryViewer = useGalleryViewer()
const {
  remixingId,
  handleDelete,
  handleUseAsSource,
  handleUsePrompt,
  handleRetry,
  openViewer,
  handleUpscale,
  handleRemix,
  handleCompare,
  handleToggleFavorite,
} = useGalleryActions({ store, galleryViewer })

const route = useRoute()
const activeFilter = computed(() => (route.query.filter as string) || 'all')
const activeSort = computed(() => ((route.query.sort as string) === 'rank' ? 'rank' : 'recent'))

const serverFilters = computed<GenerationQueryFilters>(() => {
  const f = activeFilter.value
  if (f === 'images') return { type: 'image', sort: activeSort.value }
  if (f === 'videos') return { type: 'video', sort: activeSort.value }
  if (f !== 'all') return { mode: f, sort: activeSort.value }
  return { sort: activeSort.value }
})

const limit = 24
const searchQuery = ref((route.query.search as string) || '')
const debouncedSearchQuery = ref((route.query.search as string) || '')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (newVal) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    debouncedSearchQuery.value = newVal
  }, 300)
})

watch(debouncedSearchQuery, () => load())
watch(activeFilter, () => load())
watch(activeSort, () => load())

async function load() {
  await store.load(limit, debouncedSearchQuery.value, serverFilters.value)
}

async function loadMore() {
  await store.loadMore(limit, debouncedSearchQuery.value, serverFilters.value)
}

// ── Live polling — always on, visibility-aware, never auto-stops ──
useGalleryPoller(store)

// ── Infinite scroll ───────────────────────────────────────────────
const loadMoreTarget = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  load()
  observer = new IntersectionObserver(
    ([entry]: IntersectionObserverEntry[]) => {
      if (entry?.isIntersecting) loadMore()
    },
    { rootMargin: '400px' },
  )
})

watch(loadMoreTarget, (el, oldEl) => {
  if (oldEl && observer) observer.unobserve(oldEl)
  if (el && observer) observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

// ── Sorted view ───────────────────────────────────────────────────
const filteredGenerations = computed(() => {
  const sorted = [...store.items].sort((a, b) => {
    if (activeSort.value === 'rank') {
      if (b.comparisonScore !== a.comparisonScore) {
        return b.comparisonScore - a.comparisonScore
      }
      if (b.comparisonWins !== a.comparisonWins) {
        return b.comparisonWins - a.comparisonWins
      }
      const comparedAtDiff =
        new Date(b.lastComparedAt || b.createdAt).getTime() -
        new Date(a.lastComparedAt || a.createdAt).getTime()
      if (comparedAtDiff !== 0) {
        return comparedAtDiff
      }
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Client-side favorites filter
  if (activeFilter.value === 'favorites') {
    return sorted.filter((g) => g.isFavorite)
  }

  return sorted
})

// ── Sync viewer when list changes ─────────────────────────────────
watch(filteredGenerations, (newList) => {
  if (galleryViewer.isOpen.value) galleryViewer.updateItems(newList)
})

function setFilter(value: string) {
  navigateTo({ query: { ...route.query, filter: value === 'all' ? undefined : value } })
}

function setSort(value: 'recent' | 'rank') {
  navigateTo({ query: { ...route.query, sort: value === 'recent' ? undefined : value } })
}

const filters = [
  { label: 'All', value: 'all', icon: 'i-lucide-layout-grid' },
  { label: 'Favorites', value: 'favorites', icon: 'i-lucide-heart' },
  { label: 'Images', value: 'images', icon: 'i-lucide-image' },
  { label: 'Videos', value: 'videos', icon: 'i-lucide-video' },
]

// Mobile view toggle — default compact 2-col
const mobileCompact = ref(true)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-safe">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="font-display text-3xl sm:text-4xl font-bold mb-2">Gallery</h1>
        <p class="text-muted">Your AI-generated images and videos</p>
      </div>
      <UButton
        to="/generate"
        icon="i-lucide-sparkles"
        label="New Generation"
        class="rounded-full self-start"
      />
    </div>

    <!-- Filter and Search Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="filterItem in filters"
          :key="filterItem.value"
          :icon="filterItem.icon"
          :label="filterItem.label"
          :variant="activeFilter === filterItem.value ? 'solid' : 'outline'"
          :color="activeFilter === filterItem.value ? 'primary' : 'neutral'"
          size="sm"
          class="rounded-full"
          :class="activeFilter === filterItem.value ? 'shadow-lg shadow-primary/20' : ''"
          @click="setFilter(filterItem.value)"
        />
      </div>

      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-clock-3"
          label="Newest"
          :variant="activeSort === 'recent' ? 'solid' : 'outline'"
          :color="activeSort === 'recent' ? 'primary' : 'neutral'"
          size="sm"
          class="rounded-full"
          @click="setSort('recent')"
        />
        <UButton
          icon="i-lucide-trophy"
          label="Rank"
          :variant="activeSort === 'rank' ? 'solid' : 'outline'"
          :color="activeSort === 'rank' ? 'primary' : 'neutral'"
          size="sm"
          class="rounded-full"
          @click="setSort('rank')"
        />
      </div>

      <div class="w-full sm:w-64 shrink-0">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search prompts & presets..."
          size="sm"
        />
      </div>

      <!-- Mobile view toggle -->
      <div class="flex items-center gap-2">
        <UButton
          :icon="mobileCompact ? 'i-lucide-list' : 'i-lucide-grid-2x2'"
          color="neutral"
          variant="ghost"
          size="sm"
          class="sm:hidden rounded-full"
          :aria-label="mobileCompact ? 'Switch to list view' : 'Switch to compact view'"
          @click="mobileCompact = !mobileCompact"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex flex-col items-center gap-4 py-24">
      <div class="relative">
        <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-primary" />
        <div class="absolute inset-0 animate-glow-pulse rounded-full" />
      </div>
      <p class="text-sm text-muted">Loading your creations...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!filteredGenerations.length"
      class="flex flex-col items-center gap-5 py-24 text-center"
    >
      <div class="size-20 rounded-2xl bg-primary/5 flex items-center justify-center">
        <UIcon name="i-lucide-image-off" class="size-10 text-dimmed" />
      </div>
      <div>
        <p class="text-lg font-medium mb-1">No generations yet</p>
        <p class="text-sm text-muted">Create your first masterpiece</p>
      </div>
      <UButton
        to="/generate"
        icon="i-lucide-sparkles"
        label="Start Creating"
        class="rounded-full"
      />
    </div>

    <!-- Grid -->
    <div v-else class="space-y-8">
      <div
        class="grid gap-3 sm:gap-5 stagger-children"
        :class="[
          mobileCompact
            ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        ]"
      >
        <GenerationCard
          v-for="gen in filteredGenerations"
          :key="gen.id"
          :generation="gen"
          :remixing="remixingId === gen.id"
          :compact="mobileCompact"
          @click="openViewer(gen, filteredGenerations, loadMore)"
          @use-as-source="handleUseAsSource"
          @use-prompt="handleUsePrompt"
          @upscale="handleUpscale"
          @delete="handleDelete"
          @retry="handleRetry"
          @remix="handleRemix"
          @compare="(generation) => handleCompare(generation, 'gallery-card')"
          @favorite="handleToggleFavorite"
        />
      </div>

      <!-- Infinite Scroll Trigger -->
      <div ref="loadMoreTarget" class="h-20 flex items-center justify-center w-full">
        <div v-if="store.loadingMore" class="flex flex-col items-center gap-2">
          <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        </div>
        <p
          v-else-if="store.isFinished && filteredGenerations.length > 0"
          class="text-sm text-dimmed uppercase tracking-widest font-semibold flex items-center gap-2"
        >
          <UIcon name="i-lucide-check-circle-2" class="size-4" /> End of Gallery
        </p>
      </div>
    </div>

    <!-- Gallery Viewer -->
    <GalleryViewer />
  </div>
</template>
