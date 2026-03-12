<script setup lang="ts">
import type { Generation } from '~/types/generation'

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
const { deleteGeneration, upscaleGeneration, remixGeneration, error: generateError } = useGenerate()
const remixingId = ref<string | null>(null)
const toast = useToast()
const galleryViewer = useGalleryViewer()

const route = useRoute()
const activeFilter = computed(() => (route.query.filter as string) || 'all')

const serverFilters = computed(() => {
  const f = activeFilter.value
  if (f === 'images') return { type: 'image' }
  if (f === 'videos') return { type: 'video' }
  if (f !== 'all') return { mode: f }
  return {}
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

async function load() {
  await store.load(limit, debouncedSearchQuery.value, serverFilters.value)
}

async function loadMore() {
  await store.loadMore(limit, debouncedSearchQuery.value, serverFilters.value)
}

// ── Live polling — always on, visibility-aware, never auto-stops ──
useGalleryPoller()

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
const filteredGenerations = computed(() =>
  [...store.items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
)

// ── Sync viewer when list changes ─────────────────────────────────
watch(filteredGenerations, (newList) => {
  if (galleryViewer.isOpen.value) galleryViewer.updateItems(newList)
})

// ── Actions ───────────────────────────────────────────────────────
async function handleDelete(gen: Generation) {
  try {
    await deleteGeneration(gen.id)
    store.remove(gen.id)
  } catch {
    /* silent */
  }
}

function setFilter(value: string) {
  navigateTo({ query: { ...route.query, filter: value === 'all' ? undefined : value } })
}

function handleUseAsSource(gen: Generation) {
  navigateTo({ path: '/generate', query: { source: gen.id, mode: 'i2v' } })
}

function handleRetry(gen: Generation) {
  navigateTo({ path: '/generate', query: { prompt: gen.prompt, mode: gen.mode } })
}

function openViewer(gen: Generation) {
  const idx = filteredGenerations.value.findIndex((g) => g.id === gen.id)
  galleryViewer.open(filteredGenerations.value, idx >= 0 ? idx : 0, loadMore)
}

async function handleUpscale(gen: Generation) {
  const result = await upscaleGeneration(gen.id)
  if (result) {
    store.upsert(result)
    toast.add({
      title: 'Upscaling Started',
      description:
        'Your image is being upscaled to 2K resolution. It will appear at the top of your gallery shortly.',
      color: 'success',
      icon: 'i-lucide-sparkles',
    })
  } else if (generateError.value) {
    toast.add({
      title: 'Upscale Failed',
      description: generateError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function handleRemix(gen: Generation) {
  if (remixingId.value) return
  remixingId.value = gen.id
  toast.add({
    title: 'Remixing…',
    description: 'Creating a fresh variation of your prompt.',
    color: 'info',
    icon: 'i-lucide-shuffle',
  })
  try {
    const result = await remixGeneration(gen)
    if (result) {
      store.upsert(result)
      toast.add({
        title: 'Remix Created',
        description:
          result.type === 'video'
            ? 'Your remixed video is generating!'
            : 'A remixed image has been created!',
        color: 'success',
        icon: 'i-lucide-shuffle',
      })
    } else if (generateError.value) {
      toast.add({
        title: 'Remix Failed',
        description: generateError.value,
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  } finally {
    remixingId.value = null
  }
}

const filters = [
  { label: 'All', value: 'all', icon: 'i-lucide-layout-grid' },
  { label: 'Images', value: 'images', icon: 'i-lucide-image' },
  { label: 'Videos', value: 'videos', icon: 'i-lucide-video' },
]
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
      <div class="flex gap-2">
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

      <div class="w-full sm:w-64 shrink-0">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search prompts & presets..."
          size="sm"
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
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        <GenerationCard
          v-for="gen in filteredGenerations"
          :key="gen.id"
          :generation="gen"
          :remixing="remixingId === gen.id"
          @click="openViewer(gen)"
          @use-as-source="handleUseAsSource"
          @upscale="handleUpscale"
          @delete="handleDelete"
          @retry="handleRetry"
          @remix="handleRemix"
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
