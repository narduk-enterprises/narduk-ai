<script setup lang="ts">
import type { Generation } from '~/types/generation'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const genId = route.params.id as string

const {
  fetchGeneration,
  deleteGeneration,
  generateImage,
  generateVideo,
  generateVideoFromImage,
  editImage,
} = useGenerate()

const generation = ref<Generation | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const retrying = ref(false)

async function load() {
  loading.value = true
  try {
    generation.value = await fetchGeneration(genId)
  } catch {
    error.value = 'Generation not found'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const modeLabels: Record<string, string> = {
  t2i: 'Text → Image',
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  i2i: 'Image → Image',
}

async function handleDelete() {
  if (!generation.value) return
  await deleteGeneration(generation.value.id)
  await navigateTo('/gallery', { replace: true })
}

async function handleRetry() {
  if (!generation.value || retrying.value) return
  retrying.value = true
  const gen = generation.value
  let result: Generation | null = null

  try {
    if (gen.mode === 't2i') {
      result = await generateImage(gen.prompt, gen.aspectRatio || undefined)
    } else if (gen.mode === 't2v') {
      result = await generateVideo(gen.prompt, {
        duration: gen.duration || 6,
        aspectRatio: gen.aspectRatio || '16:9',
        resolution: gen.resolution || '720p',
      })
    } else if (gen.mode === 'i2v' && gen.sourceGenerationId) {
      result = await generateVideoFromImage(gen.prompt, gen.sourceGenerationId, {
        duration: gen.duration || 6,
        resolution: gen.resolution || '720p',
      })
    } else if (gen.mode === 'i2i' && gen.sourceGenerationId) {
      result = await editImage(gen.prompt, gen.sourceGenerationId)
    }

    if (result) {
      await navigateTo(`/gallery/${result.id}`, { replace: true })
    }
  } finally {
    retrying.value = false
  }
}

useSeo({
  title: 'Generation Detail — Narduk AI',
  description: 'View your AI-generated media.',
})
useWebPageSchema({
  name: 'Generation Detail — Narduk AI',
  description: 'View your AI-generated media.',
})

const statusBadgeColor = computed(() => {
  if (!generation.value) return 'neutral'
  if (generation.value.status === 'done') return 'success'
  if (generation.value.status === 'pending') return 'warning'
  return 'error'
})

const formattedCreatedAt = computed(() => {
  if (!generation.value) return ''
  return new Date(generation.value.createdAt).toLocaleString()
})

const mediaType = computed(() => {
  return (generation.value?.type ?? 'image') as 'image' | 'video'
})

const metadataItems = computed(() => {
  if (!generation.value) return []
  const items = [
    { label: 'Type', value: generation.value.type, capitalize: true },
    { label: 'Mode', value: modeLabels[generation.value.mode] },
    { label: 'Created', value: formattedCreatedAt.value },
  ]
  if (generation.value.duration)
    items.push({ label: 'Duration', value: `${generation.value.duration}s` })
  if (generation.value.aspectRatio)
    items.push({ label: 'Aspect Ratio', value: generation.value.aspectRatio })
  if (generation.value.resolution)
    items.push({ label: 'Resolution', value: generation.value.resolution })
  return items
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-24">
      <div class="relative">
        <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-primary" />
        <div class="absolute inset-0 animate-glow-pulse rounded-full" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center gap-5 py-24 text-center">
      <div class="size-20 rounded-2xl bg-error/5 flex items-center justify-center">
        <UIcon name="i-lucide-image-off" class="size-10 text-error" />
      </div>
      <div>
        <h1 class="font-display text-2xl font-bold mb-2">Not Found</h1>
        <p class="text-muted">{{ error }}</p>
      </div>
      <UButton to="/gallery" label="Back to Gallery" class="rounded-full" />
    </div>

    <!-- Generation Detail -->
    <template v-else-if="generation">
      <!-- Back + Header -->
      <div class="mb-6">
        <UButton
          to="/gallery"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Back"
          size="sm"
          class="rounded-full mb-4"
        />
        <div class="flex items-start gap-3">
          <div>
            <h1 class="font-display text-2xl sm:text-3xl font-bold">
              {{ modeLabels[generation.mode] || generation.mode }}
            </h1>
            <p class="text-muted mt-1 leading-relaxed">{{ generation.prompt }}</p>
          </div>
          <UBadge :color="statusBadgeColor" :label="generation.status" class="mt-1 shrink-0" />
        </div>
      </div>

      <div class="space-y-6">
        <!-- Media -->
        <template v-if="generation.status === 'done' && generation.mediaUrl">
          <MediaPlayer :src="generation.mediaUrl" :type="mediaType" :alt="generation.prompt" />
        </template>
        <div
          v-else-if="generation.status === 'pending'"
          class="flex flex-col items-center gap-4 py-20 glass-card"
        >
          <div class="relative">
            <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
            <div class="absolute inset-0 animate-glow-pulse rounded-full" />
          </div>
          <p class="text-muted">Still generating...</p>
        </div>

        <!-- Metadata -->
        <div class="glass-card p-5">
          <div class="flex flex-wrap gap-x-8 gap-y-3">
            <div v-for="item in metadataItems" :key="item.label">
              <p class="text-xs text-dimmed mb-0.5">{{ item.label }}</p>
              <p class="text-sm font-medium" :class="{ capitalize: item.capitalize }">
                {{ item.value }}
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="generation.status === 'failed' || generation.status === 'expired'"
            icon="i-lucide-refresh-cw"
            class="rounded-full"
            :loading="retrying"
            @click="handleRetry"
          >
            Retry
          </UButton>
          <UButton
            v-if="generation.type === 'image' && generation.status === 'done'"
            icon="i-lucide-video"
            variant="outline"
            class="rounded-full"
            :to="{ path: '/generate', query: { source: generation.id, mode: 'i2v' } }"
          >
            Animate
          </UButton>
          <UButton
            v-if="generation.type === 'image' && generation.status === 'done'"
            icon="i-lucide-layers"
            variant="outline"
            class="rounded-full"
            :to="{ path: '/generate', query: { source: generation.id, mode: 'i2i' } }"
          >
            Edit
          </UButton>
          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            class="rounded-full"
            @click="handleDelete"
          >
            Delete
          </UButton>
        </div>
      </div>
    </template>
  </div>
</template>
