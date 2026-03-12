<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  item: Generation
  counter: string
  loadingMore: boolean
  isZoomed: boolean
  zoomLevel: number
  maxZoom: number
  isSelectZoomMode: boolean
  remixing: boolean
}>()

defineEmits<{
  close: []
  zoomIn: []
  zoomOut: []
  resetZoom: []
  toggleSelectZoomMode: []
  info: []
  useAsSource: []
  editImage: []
  usePrompt: []
  remix: []
  upscale: []
  delete: []
}>()

const isVideo = computed(() => props.item?.type === 'video')
const isImage = computed(() => props.item?.type === 'image')
const isDone = computed(() => props.item?.status === 'done')
</script>

<template>
  <div
    class="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/80 to-transparent"
  >
    <div class="flex items-center gap-3">
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

    <div class="flex items-center gap-1.5">
      <!-- Zoom controls (images only) -->
      <template v-if="!isVideo && isDone">
        <UTooltip text="Zoom out (-)">
          <UButton
            icon="i-lucide-zoom-out"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!isZoomed"
            class="text-white hover:bg-white/10 rounded-full"
            @click="$emit('zoomOut')"
          />
        </UTooltip>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="text-white/70 font-mono tabular-nums min-w-10 text-center hover:text-white hover:bg-white/10 rounded-md px-1"
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
            class="text-white hover:bg-white/10 rounded-full"
            @click="$emit('zoomIn')"
          />
        </UTooltip>
        <UTooltip
          :text="
            isSelectZoomMode ? 'Cancel area zoom (Esc)' : 'Select area to zoom (or Shift-drag)'
          "
        >
          <UButton
            icon="i-lucide-crop"
            color="neutral"
            variant="ghost"
            size="sm"
            class="rounded-full"
            :class="
              isSelectZoomMode
                ? 'text-white bg-primary/20 hover:bg-primary/30'
                : 'text-white hover:bg-white/10'
            "
            @click="$emit('toggleSelectZoomMode')"
          />
        </UTooltip>
        <div class="w-px h-5 bg-white/20 mx-0.5" />
      </template>

      <!-- Actions -->
      <UTooltip text="View details">
        <UButton
          icon="i-lucide-info"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('info')"
        />
      </UTooltip>
      <UTooltip v-if="isImage && isDone" text="Animate">
        <UButton
          icon="i-lucide-video"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('useAsSource')"
        />
      </UTooltip>
      <UTooltip v-if="isImage && isDone" text="Edit image">
        <UButton
          icon="i-lucide-layers"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('editImage')"
        />
      </UTooltip>
      <UTooltip v-if="isDone" text="Use prompt">
        <UButton
          icon="i-lucide-file-text"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('usePrompt')"
        />
      </UTooltip>
      <UTooltip v-if="isDone" text="Remix">
        <UButton
          icon="i-lucide-shuffle"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          :loading="remixing"
          @click="$emit('remix')"
        />
      </UTooltip>
      <UTooltip v-if="isImage && isDone" text="Upscale to 2K">
        <UButton
          icon="i-lucide-maximize-2"
          color="neutral"
          variant="ghost"
          size="sm"
          class="text-white hover:bg-white/10 rounded-full"
          @click="$emit('upscale')"
        />
      </UTooltip>
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
