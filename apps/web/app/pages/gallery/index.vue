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

const { fetchGenerations, deleteGeneration, upscaleGeneration } = useGenerate()

const route = useRoute()
const generations = ref<Generation[]>([])
const loading = ref(true)
const activeFilter = computed(() => (route.query.filter as string) || 'all')

async function load() {
  loading.value = true
  try {
    generations.value = await fetchGenerations(100)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Auto-refresh while any generations are pending
const hasPending = computed(() => generations.value.some((g) => g.status === 'pending'))
let refreshInterval: ReturnType<typeof setInterval> | null = null

watch(
  hasPending,
  (pending) => {
    if (pending && !refreshInterval) {
      refreshInterval = setInterval(async () => {
        try {
          generations.value = await fetchGenerations(100)
        } catch {
          // silent
        }
      }, 5000)
    } else if (!pending && refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

const filteredGenerations = computed(() => {
  const list =
    activeFilter.value === 'all'
      ? generations.value
      : activeFilter.value === 'images'
        ? generations.value.filter((g) => g.type === 'image')
        : activeFilter.value === 'videos'
          ? generations.value.filter((g) => g.type === 'video')
          : generations.value.filter((g) => g.mode === activeFilter.value)
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

async function handleDelete(gen: Generation) {
  try {
    await deleteGeneration(gen.id)
    generations.value = generations.value.filter((g) => g.id !== gen.id)
  } catch {
    // silent
  }
}

function handleUseAsSource(gen: Generation) {
  navigateTo({ path: '/generate', query: { source: gen.id, mode: 'i2v' } })
}

function handleRetry(gen: Generation) {
  navigateTo({ path: '/generate', query: { prompt: gen.prompt, mode: gen.mode } })
}

async function handleUpscale(gen: Generation) {
  const result = await upscaleGeneration(gen.id)
  if (result) {
    generations.value.unshift(result)
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

    <!-- Filter Bar -->
    <div class="flex gap-2 mb-6">
      <UButton
        v-for="filterItem in filters"
        :key="filterItem.value"
        :to="{ query: { filter: filterItem.value === 'all' ? undefined : filterItem.value } }"
        :icon="filterItem.icon"
        :label="filterItem.label"
        :variant="activeFilter === filterItem.value ? 'solid' : 'outline'"
        :color="activeFilter === filterItem.value ? 'primary' : 'neutral'"
        size="sm"
        class="rounded-full"
        :class="activeFilter === filterItem.value ? 'shadow-lg shadow-primary/20' : ''"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-24">
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
    <div v-else class="columns-1 gap-5 sm:columns-2 lg:columns-3 stagger-children">
      <GenerationCard
        v-for="gen in filteredGenerations"
        :key="gen.id"
        :generation="gen"
        class="break-inside-avoid mb-5"
        @click="navigateTo(`/gallery/${gen.id}`)"
        @use-as-source="handleUseAsSource"
        @upscale="handleUpscale"
        @delete="handleDelete"
        @retry="handleRetry"
      />
    </div>
  </div>
</template>
