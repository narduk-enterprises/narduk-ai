<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  item: Generation
  counter: string
  loadingMore: boolean
  isZoomed: boolean
  zoomLevel: number
  maxZoom: number
  remixing: boolean
}>()

const emit = defineEmits<{
  close: []
  zoomIn: []
  zoomOut: []
  resetZoom: []
  info: []
  compare: []
  useAsSource: []
  editImage: []
  usePrompt: []
  remix: []
  upscale: []
  favorite: []
  delete: []
}>()

const isVideo = computed(() => props.item?.type === 'video')
const isImage = computed(() => props.item?.type === 'image')
const isDone = computed(() => props.item?.status === 'done')

const overflowItems = computed(() => {
  const group: { label: string; icon: string; disabled?: boolean; onSelect: () => void }[] = []

  group.push({ label: 'View details', icon: 'i-lucide-info', onSelect: () => emit('info') })

  if (isImage.value && isDone.value) {
    group.push({ label: 'Compare', icon: 'i-lucide-scale', onSelect: () => emit('compare') })
    group.push({ label: 'Animate', icon: 'i-lucide-video', onSelect: () => emit('useAsSource') })
    group.push({
      label: 'Edit image',
      icon: 'i-lucide-layers',
      onSelect: () => emit('editImage'),
    })
  }

  if (isDone.value) {
    group.push({
      label: 'Use prompt',
      icon: 'i-lucide-file-text',
      onSelect: () => emit('usePrompt'),
    })
    group.push({
      label: 'Remix',
      icon: 'i-lucide-shuffle',
      disabled: props.remixing,
      onSelect: () => emit('remix'),
    })
  }

  if (isImage.value && isDone.value) {
    group.push({
      label: 'Upscale to 2K',
      icon: 'i-lucide-maximize-2',
      onSelect: () => emit('upscale'),
    })
  }

  return [group]
})
</script>

<template>
  <div
    class="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-linear-to-b from-black/80 to-transparent"
  >
    <div class="flex items-center gap-2 sm:gap-3">
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        class="text-white hover:bg-white/10 rounded-full"
        @click="$emit('close')"
      />
      <span class="text-white/70 text-sm font-mono tabular-nums flex items-center gap-2">
        {{ counter }}
        <UIcon
          v-if="loadingMore"
          name="i-lucide-loader-2"
          class="size-3.5 animate-spin text-primary"
        />
      </span>
    </div>

    <div class="flex items-center gap-1">
      <!-- Zoom controls (desktop only, images only) -->
      <template v-if="!isVideo && isDone">
        <UTooltip text="Zoom out (-)">
          <UButton
            icon="i-lucide-zoom-out"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!isZoomed"
            class="hidden sm:flex text-white hover:bg-white/10 rounded-full"
            @click="$emit('zoomOut')"
          />
        </UTooltip>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="hidden sm:flex text-white/70 font-mono tabular-nums min-w-10 text-center hover:text-white hover:bg-white/10 rounded-md px-1"
          @click="$emit('resetZoom')"
        >
          {{ Math.round(zoomLevel * 100) }}%
        </UButton>
        <UTooltip text="Zoom in (+)">
          <UButton
            icon="i-lucide-zoom-in"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="zoomLevel >= maxZoom"
            class="hidden sm:flex text-white hover:bg-white/10 rounded-full"
            @click="$emit('zoomIn')"
          />
        </UTooltip>
        <div class="hidden sm:block w-px h-5 bg-white/20 mx-0.5" />
      </template>

      <!-- Overflow Menu -->
      <UDropdownMenu :items="overflowItems" :content="{ align: 'end', sideOffset: 8 }">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
        />
      </UDropdownMenu>

      <!-- Favorite (always visible) -->
      <UTooltip :text="props.item.isFavorite ? 'Unfavorite' : 'Favorite'">
        <UButton
          icon="i-lucide-heart"
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-full transition-all duration-200"
          :class="[
            props.item.isFavorite ? 'text-error hover:bg-error/20' : 'text-white hover:bg-white/10',
          ]"
          @click="$emit('favorite')"
        />
      </UTooltip>

      <!-- Delete (always visible, destructive) -->
      <UTooltip text="Delete">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('delete')"
        />
      </UTooltip>
    </div>
  </div>
</template>
