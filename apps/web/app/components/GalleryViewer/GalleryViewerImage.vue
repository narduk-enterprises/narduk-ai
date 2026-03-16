<script setup lang="ts">
import type { Generation } from '~/types/generation'

defineProps<{
  item: Generation
  mediaUrl: string
  hasNext: boolean
  hasPrev: boolean
}>()

const emit = defineEmits<{
  next: []
  prev: []
  zoomStateChange: [
    state: {
      isZoomed: boolean
      zoomLevel: number
      maxZoom: number
    },
  ]
}>()

const isVideo = computed(() => false)

const {
  zoomLevel,
  isZoomed,
  isDragging,
  imageContainerRef,
  imageTransform,
  MAX_ZOOM,
  resetZoom,
  zoomIn,
  zoomOut,
  handleWheelZoom,
  handleMouseDown,
  handleDblClick,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useGalleryZoom({
  isVideo,
  next: () => emit('next'),
  prev: () => emit('prev'),
})

watch(
  [isZoomed, zoomLevel],
  () => {
    emit('zoomStateChange', {
      isZoomed: isZoomed.value,
      zoomLevel: zoomLevel.value,
      maxZoom: MAX_ZOOM,
    })
  },
  { immediate: true },
)

// Expose zoom controls to parent toolbar
defineExpose({
  resetZoom,
  zoomIn,
  zoomOut,
})
</script>

<template>
  <div
    class="flex-1 flex items-center justify-center relative min-h-0 px-4 sm:px-16 overflow-hidden"
    @wheel.prevent="handleWheelZoom"
    @touchstart.passive="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend.passive="handleTouchEnd"
  >
    <!-- Prev Button (Desktop) -->
    <UButton
      v-if="hasPrev && !isZoomed"
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="ghost"
      size="xl"
      class="hidden sm:flex absolute left-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
      @click="$emit('prev')"
    />

    <!-- Image -->
    <div
      ref="imageContainerRef"
      class="relative flex items-center justify-center w-full h-full"
      :style="{
        cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
      }"
      @mousedown="handleMouseDown"
      @dblclick="handleDblClick"
    >
      <MediaImg
        :src="mediaUrl"
        :alt="item.prompt"
        class="w-full h-full object-contain select-none pointer-events-none"
        :style="{
          transform: imageTransform,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          transformOrigin: 'center center',
        }"
      />
    </div>

    <!-- Next Button (Desktop) -->
    <UButton
      v-if="hasNext && !isZoomed"
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="ghost"
      size="xl"
      class="hidden sm:flex absolute right-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
      @click="$emit('next')"
    />

    <!-- Interaction hint -->
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <span
        class="text-xs text-white/50 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full whitespace-nowrap hidden sm:inline"
      >
        <template v-if="isZoomed"> Drag to pan &middot; Double-click or press 0 to reset </template>
        <template v-else> Scroll or double-click to zoom </template>
      </span>
      <span
        class="text-xs text-white/50 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full whitespace-nowrap sm:hidden"
      >
        <template v-if="isZoomed"> Drag to pan &middot; Double-tap to reset </template>
        <template v-else> Pinch or double-tap to zoom </template>
      </span>
    </div>
  </div>
</template>
