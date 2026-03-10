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

const { fetchGenerations, deleteGeneration } = useGenerate()

const generations = ref<Generation[]>([])
const loading = ref(true)
const activeFilter = ref<string>('all')

async function load() {
  loading.value = true
  try {
    generations.value = await fetchGenerations(100)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filteredGenerations = computed(() => {
  if (activeFilter.value === 'all') return generations.value
  if (activeFilter.value === 'images') return generations.value.filter((g) => g.type === 'image')
  if (activeFilter.value === 'videos') return generations.value.filter((g) => g.type === 'video')
  return generations.value.filter((g) => g.mode === activeFilter.value)
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

const filters = [
  { label: 'All', value: 'all', icon: 'i-lucide-layout-grid' },
  { label: 'Images', value: 'images', icon: 'i-lucide-image' },
  { label: 'Videos', value: 'videos', icon: 'i-lucide-video' },
]
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
      <!-- eslint-disable-next-line narduk/no-native-button -- custom pill styling not achievable with UButton -->
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border"
        :class="
          activeFilter === filter.value
            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
            : 'border-default text-muted hover:text-default hover:border-primary/40 hover:bg-elevated/50'
        "
        @click="activeFilter = filter.value"
      >
        <UIcon :name="filter.icon" class="size-3.5" />
        {{ filter.label }}
      </button>
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
    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
      <GenerationCard
        v-for="gen in filteredGenerations"
        :key="gen.id"
        :generation="gen"
        @click="navigateTo(`/gallery/${gen.id}`)"
        @use-as-source="handleUseAsSource"
        @delete="handleDelete"
        @retry="handleRetry"
      />
    </div>
  </div>
</template>
