<script setup lang="ts">
import type { Generation } from '~/types/generation'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const genId = route.params.id as string

const {
  fetchGeneration,
  deleteGeneration,
  retryGeneration,
  pollGeneration,
  upscaleGeneration,
  error: generateError,
} = useGenerate()
const toast = useToast()

const generation = ref<Generation | null>(null)
const sourceGeneration = ref<Generation | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const retrying = ref(false)
const upscaling = ref(false)

async function load() {
  loading.value = true
  try {
    generation.value = await fetchGeneration(genId)

    // Start polling if generation is still pending
    if (generation.value?.status === 'pending' && generation.value.xaiRequestId) {
      const genRef = generation as Ref<Generation>
      pollGeneration(genRef)
    }

    // Fetch source generation if applicable
    if (generation.value?.sourceGenerationId) {
      try {
        sourceGeneration.value = await fetchGeneration(generation.value.sourceGenerationId)
      } catch {
        // Source might be deleted, just silently fail
      }
    }
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
  try {
    const result = await retryGeneration(generation.value)
    if (result) {
      await navigateTo(`/gallery/${result.id}`, { replace: true })
    }
  } finally {
    retrying.value = false
  }
}

async function handleUpscale() {
  if (!generation.value || upscaling.value) return
  upscaling.value = true
  try {
    const result = await upscaleGeneration(generation.value.id)
    if (result) {
      toast.add({
        title: 'Upscaling Started',
        description: 'Your image is being upscaled to 2K resolution.',
        color: 'success',
        icon: 'i-lucide-sparkles',
      })
      await navigateTo(`/gallery/${result.id}`)
    } else if (generateError.value) {
      toast.add({
        title: 'Upscale Failed',
        description: generateError.value,
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  } finally {
    upscaling.value = false
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

const errorMessage = computed(() => {
  if (!generation.value?.metadata) return null
  try {
    const meta = JSON.parse(generation.value.metadata)
    if (meta.error?.message) return meta.error.message
    if (typeof meta.error === 'string') return meta.error
    return null
  } catch {
    return null
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-safe">
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
        <div class="flex items-center gap-3">
          <UButton
            to="/gallery"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-left"
            class="rounded-full shrink-0"
          />
          <h1 class="font-display text-2xl sm:text-3xl font-bold truncate">
            {{ modeLabels[generation.mode] || generation.mode }}
          </h1>
          <UBadge :color="statusBadgeColor" :label="generation.status" class="shrink-0" />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content Area -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Primary Media -->
          <div class="glass-card p-2 sm:p-4">
            <template v-if="generation.status === 'done' && generation.mediaUrl">
              <MediaPlayer :src="generation.mediaUrl" :type="mediaType" :alt="generation.prompt" />
            </template>
            <div
              v-else-if="generation.status === 'pending'"
              class="flex flex-col items-center justify-center min-h-[50vh] gap-4 py-20 bg-elevated/30 rounded-2xl neon-border"
            >
              <div class="relative">
                <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
                <div class="absolute inset-0 animate-glow-pulse rounded-full" />
              </div>
              <p class="text-muted">Still generating...</p>
            </div>

            <!-- Error Message -->
            <div
              v-if="generation.status === 'failed' || generation.status === 'expired'"
              class="rounded-2xl border border-error/20 bg-error/5 p-8 flex flex-col items-center text-center gap-3 min-h-[50vh] justify-center"
            >
              <UIcon name="i-lucide-alert-triangle" class="size-10 text-error mb-2" />
              <p class="font-medium text-error text-lg">Generation {{ generation.status }}</p>
              <p class="text-muted max-w-sm">
                {{ errorMessage || 'Something went wrong. No additional details are available.' }}
              </p>
            </div>
          </div>

          <div class="px-2 flex items-start gap-3 group">
            <p class="text-lg leading-relaxed text-default font-medium flex-1">
              "{{ generation.prompt }}"
            </p>
            <CopyPromptButton
              :prompt="generation.prompt"
              class="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity mt-1"
            />
          </div>
        </div>

        <!-- Sidebar / Details -->
        <div class="space-y-6">
          <!-- Actions -->
          <div class="glass-card p-5">
            <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">Actions</h3>
            <div class="flex flex-col gap-2.5">
              <UTooltip
                v-if="generation.status === 'failed' || generation.status === 'expired'"
                text="Retry this generation"
              >
                <UButton
                  icon="i-lucide-refresh-cw"
                  class="rounded-xl justify-center w-full"
                  :loading="retrying"
                  block
                  @click="handleRetry"
                >
                  Retry Generation
                </UButton>
              </UTooltip>
              <UTooltip
                v-if="generation.type === 'image' && generation.status === 'done'"
                text="Create a video from this image"
              >
                <UButton
                  icon="i-lucide-video"
                  variant="outline"
                  class="rounded-xl justify-center w-full"
                  block
                  :to="{ path: '/generate', query: { source: generation.id, mode: 'i2v' } }"
                >
                  Animate this Image
                </UButton>
              </UTooltip>
              <UTooltip
                v-if="generation.type === 'image' && generation.status === 'done'"
                text="Create a new image based on this one"
              >
                <UButton
                  icon="i-lucide-layers"
                  variant="outline"
                  class="rounded-xl justify-center w-full"
                  block
                  :to="{ path: '/generate', query: { source: generation.id, mode: 'i2i' } }"
                >
                  Edit this Image
                </UButton>
              </UTooltip>
              <UTooltip
                v-if="generation.type === 'image' && generation.status === 'done'"
                text="Increase resolution to 2K (Costs more)"
              >
                <UButton
                  icon="i-lucide-maximize-2"
                  variant="outline"
                  class="rounded-xl justify-center w-full"
                  :loading="upscaling"
                  block
                  @click="handleUpscale"
                >
                  Upscale to 2K
                </UButton>
              </UTooltip>
              <UTooltip text="Permanently delete this generation">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  class="rounded-xl justify-center w-full mt-2"
                  block
                  @click="handleDelete"
                >
                  Delete
                </UButton>
              </UTooltip>
            </div>
          </div>

          <!-- Metadata -->
          <div class="glass-card p-5">
            <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">Details</h3>
            <dl class="space-y-3">
              <div
                v-for="item in metadataItems"
                :key="item.label"
                class="flex justify-between items-center"
              >
                <dt class="text-sm text-dimmed">{{ item.label }}</dt>
                <dd class="text-sm font-medium" :class="{ capitalize: item.capitalize }">
                  {{ item.value }}
                </dd>
              </div>
            </dl>
          </div>

          <!-- Source Image (If Applicable) -->
          <div class="glass-card p-5" v-if="generation.mode === 'i2i' || generation.mode === 'i2v'">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-muted uppercase tracking-wider">
                Source Image
              </h3>
              <UButton
                v-if="sourceGeneration"
                :to="`/gallery/${sourceGeneration.id}`"
                variant="link"
                color="primary"
                size="xs"
                trailing-icon="i-lucide-arrow-right"
                :padded="false"
              >
                View Details
              </UButton>
            </div>

            <div
              v-if="sourceGeneration?.mediaUrl"
              class="relative group rounded-xl overflow-hidden neon-border"
            >
              <NuxtImg
                :src="sourceGeneration.mediaUrl"
                :alt="sourceGeneration.prompt"
                class="w-full h-auto aspect-square object-contain"
                placeholder
                loading="lazy"
              />
              <NuxtLink
                :to="`/gallery/${sourceGeneration.id}`"
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm"
              >
                <span class="text-white font-medium flex items-center gap-2"
                  ><UIcon name="i-lucide-eye" class="size-4" /> View Original</span
                >
              </NuxtLink>
            </div>
            <div
              v-else-if="sourceGeneration === null"
              class="py-12 bg-elevated/30 rounded-xl flex flex-col items-center justify-center border border-dashed border-border text-center px-4"
            >
              <UIcon name="i-lucide-image-minus" class="size-8 text-dimmed mb-2" />
              <p class="text-sm text-muted">Loading source image...</p>
            </div>
            <div
              v-else
              class="py-12 bg-elevated/30 rounded-xl flex flex-col items-center justify-center border border-dashed border-border text-center px-4"
            >
              <UIcon name="i-lucide-image-off" class="size-8 text-dimmed mb-2" />
              <p class="text-sm text-muted">Source image no longer exists</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
