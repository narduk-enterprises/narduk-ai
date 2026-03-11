<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  generation: Generation
}>()

const emit = defineEmits<{
  click: []
  'use-as-source': [generation: Generation]
  upscale: [generation: Generation]
  delete: [generation: Generation]
  retry: [generation: Generation]
}>()

const modeLabels: Record<string, string> = {
  t2i: 'Text → Image',
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  i2i: 'Image → Image',
}

const statusColors: Record<string, string> = {
  done: 'success',
  pending: 'warning',
  failed: 'error',
  expired: 'neutral',
}

const aspectClass = computed(() => {
  const ratio = props.generation.aspectRatio
  if (!ratio) return props.generation.type === 'video' ? 'aspect-video' : 'aspect-square'

  const map: Record<string, string> = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
    '4:3': 'aspect-[4/3]',
    '3:4': 'aspect-[3/4]',
    '3:2': 'aspect-[3/2]',
    '2:3': 'aspect-[2/3]',
  }
  return map[ratio] || (props.generation.type === 'video' ? 'aspect-video' : 'aspect-square')
})

const errorSummary = computed(() => {
  if (props.generation.status !== 'failed' && props.generation.status !== 'expired') return null
  if (!props.generation.metadata) {
    return props.generation.status === 'expired' ? 'Expired' : 'Failed'
  }
  try {
    const meta = JSON.parse(props.generation.metadata)
    if (meta.error?.message) return meta.error.message
    if (typeof meta.error === 'string') return meta.error
    return props.generation.status === 'expired' ? 'Expired' : 'Failed'
  } catch {
    return 'Failed'
  }
})

function handleUseAsSource() {
  emit('use-as-source', props.generation)
}

function handleRetry() {
  emit('retry', props.generation)
}

function handleDelete() {
  emit('delete', props.generation)
}

function handleUpscale() {
  emit('upscale', props.generation)
}
</script>

<template>
  <NuxtLink
    :to="`/gallery/${generation.id}`"
    class="glow-card group block cursor-pointer overflow-hidden"
  >
    <!-- Media Preview -->
    <div :class="['relative w-full overflow-hidden bg-elevated/50', aspectClass]">
      <template v-if="generation.status === 'done' && generation.mediaUrl">
        <NuxtImg
          v-if="generation.type === 'image'"
          :src="generation.mediaUrl"
          :alt="generation.prompt"
          class="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          placeholder
          loading="lazy"
        />
        <video
          v-else
          :src="generation.mediaUrl"
          loop
          muted
          playsinline
          class="h-full w-full object-contain"
        />
      </template>
      <div v-else class="flex h-full w-full items-center justify-center">
        <UIcon
          v-if="generation.status === 'pending'"
          name="i-lucide-loader-2"
          class="size-8 animate-spin text-primary"
        />
        <UIcon
          v-else-if="generation.status === 'failed'"
          name="i-lucide-alert-triangle"
          class="size-8 text-error"
        />
        <UIcon v-else name="i-lucide-clock" class="size-8 text-muted" />
      </div>

      <!-- Hover Overlay -->
      <div
        class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      />

      <!-- Type badge -->
      <UBadge
        :color="generation.type === 'video' ? 'info' : 'primary'"
        variant="solid"
        size="xs"
        class="absolute left-2.5 top-2.5"
        :icon="generation.type === 'video' ? 'i-lucide-video' : 'i-lucide-image'"
        :label="generation.type === 'video' ? 'Video' : 'Image'"
      />

      <!-- Duration badge (videos) -->
      <UBadge
        v-if="generation.type === 'video' && generation.duration"
        color="neutral"
        variant="solid"
        size="xs"
        class="absolute bottom-2.5 right-2.5"
        :label="`${generation.duration}s`"
      />
    </div>

    <!-- Info -->
    <div class="p-4 space-y-2">
      <div class="flex items-center gap-2">
        <UBadge
          :color="
            (statusColors[generation.status] as 'success' | 'warning' | 'error' | 'neutral') ||
            'neutral'
          "
          variant="subtle"
          size="xs"
          :label="generation.status"
        />
        <span class="text-xs text-dimmed">{{
          modeLabels[generation.mode] || generation.mode
        }}</span>
      </div>

      <div class="relative group/prompt">
        <p class="line-clamp-2 text-sm text-muted leading-relaxed pr-8">
          {{ generation.prompt }}
        </p>
        <CopyPromptButton
          :prompt="generation.prompt"
          class="absolute right-0 top-0 opacity-100 md:opacity-0 group-hover/prompt:opacity-100 transition-opacity"
        />
      </div>

      <!-- Error summary for failed/expired -->
      <p v-if="errorSummary" class="text-xs text-error truncate">
        {{ errorSummary }}
      </p>

      <div class="flex items-center justify-between pt-1">
        <span class="text-xs text-dimmed">
          {{ new Date(generation.createdAt).toLocaleDateString() }}
        </span>
        <div
          class="flex gap-1 opacity-100 md:opacity-0 transition-opacity duration-200 md:group-hover:opacity-100"
        >
          <UTooltip
            v-if="generation.status === 'failed' || generation.status === 'expired'"
            text="Retry"
          >
            <UButton
              size="sm"
              variant="ghost"
              color="warning"
              icon="i-lucide-refresh-cw"
              class="touch-target"
              @click.stop.prevent="handleRetry"
            />
          </UTooltip>
          <UTooltip
            v-if="generation.type === 'image' && generation.status === 'done'"
            text="Upscale to 2K"
          >
            <UButton
              size="sm"
              variant="ghost"
              color="primary"
              icon="i-lucide-maximize-2"
              class="touch-target"
              @click.stop.prevent="handleUpscale"
            />
          </UTooltip>
          <UTooltip
            v-if="generation.type === 'image' && generation.status === 'done'"
            text="Use as source"
          >
            <UButton
              size="sm"
              variant="ghost"
              color="primary"
              icon="i-lucide-wand-2"
              class="touch-target"
              @click.stop.prevent="handleUseAsSource"
            />
          </UTooltip>
          <UTooltip text="Delete">
            <UButton
              size="sm"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              class="touch-target"
              @click.stop.prevent="handleDelete"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
