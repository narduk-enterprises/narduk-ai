<script setup lang="ts">
import type { Generation } from '~/types/generation'

defineProps<{
  item: Generation
  mediaUrl: string
  hasNext: boolean
  hasPrev: boolean
}>()

defineEmits<{
  next: []
  prev: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

const {
  isPlaying,
  isMuted,
  currentTime,
  videoDuration,
  progressPercent,
  showControls,
  togglePlay,
  toggleMute,
  handleTimeUpdate,
  handleLoadedMetadata,
  seekTo,
  formatTime,
  handleVideoClick,
  handleMouseMoveOnVideo,
  resetVideoState,
  playVideo,
} = useGalleryVideo({ videoRef })

defineExpose({
  resetVideoState,
  playVideo,
})
</script>

<template>
  <div
    class="flex-1 flex items-center justify-center relative min-h-0 px-4 sm:px-16 overflow-hidden"
  >
    <!-- Prev Button (Desktop) -->
    <UButton
      v-if="hasPrev"
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="ghost"
      size="xl"
      class="hidden sm:flex absolute left-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
      @click="$emit('prev')"
    />

    <div
      class="relative flex items-center justify-center w-full h-full"
      @mousemove="handleMouseMoveOnVideo"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
      <video
        ref="videoRef"
        :src="mediaUrl"
        :muted="isMuted"
        loop
        playsinline
        class="w-full h-full object-contain select-none cursor-pointer"
        @click="handleVideoClick"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
      />

      <!-- Custom Controls Overlay -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-show="showControls"
          class="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/80 to-transparent px-4 pb-4 pt-12"
          @click.stop
        >
          <!-- Progress Bar -->
          <div
            class="group relative h-1 hover:h-2 bg-white/20 rounded-full cursor-pointer mb-3 transition-all"
            role="slider"
            :aria-valuenow="Math.round(progressPercent)"
            aria-valuemin="0"
            aria-valuemax="100"
            tabindex="0"
            @click="seekTo"
          >
            <div
              class="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              :style="{ width: `${progressPercent}%` }"
            />
            <div
              class="absolute top-1/2 -translate-y-1/2 size-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              :style="{ left: `calc(${progressPercent}% - 6px)` }"
            />
          </div>

          <!-- Controls Row -->
          <div class="flex items-center gap-3">
            <UButton
              :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-white hover:bg-white/10 rounded-full"
              @click="togglePlay"
            />
            <span class="text-white/70 text-xs font-mono tabular-nums">
              {{ formatTime(currentTime) }} / {{ formatTime(videoDuration) }}
            </span>
            <div class="flex-1" />
            <UButton
              :icon="isMuted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-white hover:bg-white/10 rounded-full"
              @click="toggleMute"
            />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Next Button (Desktop) -->
    <UButton
      v-if="hasNext"
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="ghost"
      size="xl"
      class="hidden sm:flex absolute right-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
      @click="$emit('next')"
    />
  </div>
</template>
