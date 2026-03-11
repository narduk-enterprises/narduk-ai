<script setup lang="ts">
import type { Generation } from '~/types/generation'

defineOptions({ inheritAttrs: false })

const {
  isOpen,
  currentItem,
  currentIndex,
  items,
  hasNext,
  hasPrev,
  counter,
  loadingMore,
  next,
  prev,
  close,
} = useGalleryViewer()

const {
  deleteGeneration,
  upscaleGeneration,
  remixGeneration,
  remixing: remixingRef,
  error: generateError,
} = useGenerate()
const toast = useToast()

// ── Video Controls State ──────────────────────────────────
const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const isMuted = ref(true)
const currentTime = ref(0)
const videoDuration = ref(0)
const progressPercent = computed(() =>
  videoDuration.value > 0 ? (currentTime.value / videoDuration.value) * 100 : 0,
)
const showControls = ref(true)
let controlsTimer: ReturnType<typeof setTimeout> | null = null

// ── Media Type ───────────────────────────────────────────
const isVideo = computed(() => currentItem.value?.type === 'video')
const mediaUrl = computed(() => currentItem.value?.mediaUrl ?? '')

// ── Mode Labels ──────────────────────────────────────────
const modeLabels: Record<string, string> = {
  t2i: 'Text → Image',
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  i2i: 'Image → Image',
}

// ── Metadata ─────────────────────────────────────────────
const formattedDate = computed(() => {
  if (!currentItem.value) return ''
  return new Date(currentItem.value.createdAt).toLocaleString()
})

const parsedPresets = computed(() => {
  if (!currentItem.value?.presets) return null
  try {
    const raw = JSON.parse(currentItem.value.presets) as Record<string, string>
    return Object.entries(raw)
      .filter(([_, val]) => Boolean(val))
      .map(([key, val]) => ({
        type: key,
        name: val,
        label: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`,
      }))
  } catch {
    return null
  }
})

function handlePresetClick(presetName: string) {
  close()
  navigateTo({ path: '/gallery', query: { search: presetName } })
}

// ── Keyboard Navigation ──────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    next()
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    prev()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === ' ' && isVideo.value) {
    e.preventDefault()
    togglePlay()
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown)
  }
})

// ── Touch / Swipe Navigation ─────────────────────────────
const touchStartX = ref(0)
const touchStartY = ref(0)

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) {
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
  }
}

function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value

  // Only trigger if horizontal swipe is dominant and exceeds threshold
  if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    if (deltaX < 0) next()
    else prev()
  }
}

// ── Video Controls ───────────────────────────────────────
function togglePlay() {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
    isPlaying.value = true
  } else {
    videoRef.value.pause()
    isPlaying.value = false
  }
}

function toggleMute() {
  if (!videoRef.value) return
  videoRef.value.muted = !videoRef.value.muted
  isMuted.value = videoRef.value.muted
}

function handleTimeUpdate() {
  if (!videoRef.value) return
  currentTime.value = videoRef.value.currentTime
}

function handleLoadedMetadata() {
  if (!videoRef.value) return
  videoDuration.value = videoRef.value.duration
}

function seekTo(e: MouseEvent) {
  if (!videoRef.value) return
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  videoRef.value.currentTime = ratio * videoDuration.value
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function scheduleHideControls() {
  showControls.value = true
  if (controlsTimer) clearTimeout(controlsTimer)
  controlsTimer = setTimeout(() => {
    if (isPlaying.value) showControls.value = false
  }, 3000)
}

function handleVideoClick() {
  togglePlay()
  scheduleHideControls()
}

function handleMouseMoveOnVideo() {
  scheduleHideControls()
}

// ── Reset video state when switching items ────────────────
watch(currentIndex, () => {
  isPlaying.value = false
  currentTime.value = 0
  videoDuration.value = 0
  showControls.value = true
  if (controlsTimer) clearTimeout(controlsTimer)

  // Auto-play video on switch
  nextTick(() => {
    if (videoRef.value && isVideo.value) {
      videoRef.value.currentTime = 0
      videoRef.value
        .play()
        .then(() => {
          isPlaying.value = true
          scheduleHideControls()
          return
        })
        .catch(() => {
          // autoplay blocked
        })
    }
  })
})

// ── Auto-play on open ────────────────────────────────────
watch(isOpen, (open) => {
  if (open && isVideo.value) {
    nextTick(() => {
      if (videoRef.value) {
        videoRef.value
          .play()
          .then(() => {
            isPlaying.value = true
            scheduleHideControls()
            return
          })
          .catch(() => {
            // autoplay blocked
          })
      }
    })
  }
  // Lock body scroll when open
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

// ── Actions ──────────────────────────────────────────────
const upscaling = ref(false)

function handleInfo() {
  if (!currentItem.value) return
  close()
  navigateTo(`/gallery/${currentItem.value.id}`)
}

async function handleRemix() {
  if (!currentItem.value || remixingRef.value) return
  toast.add({
    title: 'Remixing…',
    description: 'Creating a fresh variation of your prompt.',
    color: 'info',
    icon: 'i-lucide-shuffle',
  })
  const result = await remixGeneration(currentItem.value)
  if (result) {
    toast.add({
      title: 'Remix Created',
      description:
        result.type === 'video'
          ? 'Your remixed video is generating. Check the gallery soon!'
          : 'A remixed image has been created!',
      color: 'success',
      icon: 'i-lucide-shuffle',
    })
    close()
    navigateTo(`/gallery/${result.id}`)
  } else if (generateError.value) {
    toast.add({
      title: 'Remix Failed',
      description: generateError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function handleUseAsSource() {
  if (!currentItem.value) return
  close()
  navigateTo({ path: '/generate', query: { source: currentItem.value.id, mode: 'i2v' } })
}

function handleEditImage() {
  if (!currentItem.value) return
  close()
  navigateTo({ path: '/generate', query: { source: currentItem.value.id, mode: 'i2i' } })
}

async function handleUpscale() {
  if (!currentItem.value || upscaling.value) return
  upscaling.value = true
  try {
    const result = await upscaleGeneration(currentItem.value.id)
    if (result) {
      toast.add({
        title: 'Upscaling Started',
        description: 'Your image is being upscaled to 2K resolution.',
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
  } finally {
    upscaling.value = false
  }
}

async function handleDelete() {
  if (!currentItem.value) return
  const id = currentItem.value.id
  const idx = currentIndex.value
  await deleteGeneration(id)
  // Remove from items
  items.value = items.value.filter((g: Generation) => g.id !== id)
  if (items.value.length === 0) {
    close()
  } else {
    currentIndex.value = Math.min(idx, items.value.length - 1)
  }
}

// ── Cleanup ──────────────────────────────────────────────
onUnmounted(() => {
  if (controlsTimer) clearTimeout(controlsTimer)
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen && currentItem"
        class="fixed inset-0 z-50 flex flex-col bg-black"
        @touchstart.passive="handleTouchStart"
        @touchend.passive="handleTouchEnd"
      >
        <!-- Top Bar -->
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
              @click="close"
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
            <UTooltip text="View details">
              <UButton
                icon="i-lucide-info"
                color="neutral"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                @click="handleInfo"
              />
            </UTooltip>
            <UTooltip
              v-if="currentItem.type === 'image' && currentItem.status === 'done'"
              text="Animate"
            >
              <UButton
                icon="i-lucide-video"
                color="neutral"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                @click="handleUseAsSource"
              />
            </UTooltip>
            <UTooltip
              v-if="currentItem.type === 'image' && currentItem.status === 'done'"
              text="Edit image"
            >
              <UButton
                icon="i-lucide-layers"
                color="neutral"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                @click="handleEditImage"
              />
            </UTooltip>
            <UTooltip v-if="currentItem.status === 'done'" text="Remix">
              <UButton
                icon="i-lucide-shuffle"
                color="neutral"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                :loading="remixingRef"
                @click="handleRemix"
              />
            </UTooltip>
            <UTooltip
              v-if="currentItem.type === 'image' && currentItem.status === 'done'"
              text="Upscale to 2K"
            >
              <UButton
                icon="i-lucide-maximize-2"
                color="neutral"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                :loading="upscaling"
                @click="handleUpscale"
              />
            </UTooltip>
            <UTooltip text="Delete">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                class="text-white hover:bg-white/10 rounded-full"
                @click="handleDelete"
              />
            </UTooltip>
          </div>
        </div>

        <!-- Main Media Area -->
        <div class="flex-1 flex items-center justify-center relative min-h-0 px-4 sm:px-16">
          <!-- Prev Button (Desktop) -->
          <UButton
            v-if="hasPrev"
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="xl"
            class="hidden sm:flex absolute left-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
            @click="prev"
          />

          <!-- Image -->
          <div v-if="!isVideo && mediaUrl" class="flex items-center justify-center w-full h-full">
            <MediaImg
              :src="mediaUrl"
              :alt="currentItem.prompt"
              class="w-full h-full object-contain select-none"
            />
          </div>

          <!-- Video -->
          <div
            v-else-if="isVideo && mediaUrl"
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

          <!-- Pending / Error States -->
          <div
            v-else-if="currentItem.status === 'pending'"
            class="flex flex-col items-center gap-4"
          >
            <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
            <p class="text-white/60">Still generating...</p>
          </div>
          <div v-else class="flex flex-col items-center gap-4">
            <UIcon name="i-lucide-alert-triangle" class="size-12 text-error" />
            <p class="text-white/60">Generation {{ currentItem.status }}</p>
          </div>

          <!-- Remix Overlay -->
          <Transition
            enter-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            leave-active-class="transition-opacity duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="remixingRef"
              class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
            >
              <div class="relative">
                <UIcon name="i-lucide-shuffle" class="size-14 text-primary animate-spin" />
                <div class="absolute inset-0 animate-glow-pulse rounded-full" />
              </div>
              <p class="mt-4 text-lg font-medium text-white">Remixing your creation…</p>
              <p class="mt-1 text-sm text-white/60">Generating a fresh variation</p>
            </div>
          </Transition>

          <!-- Next Button (Desktop) -->
          <UButton
            v-if="hasNext"
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            size="xl"
            class="hidden sm:flex absolute right-2 z-10 text-white/60 hover:text-white hover:bg-white/10 rounded-full size-12 transition-colors"
            @click="next"
          />
        </div>

        <!-- Bottom Info Panel -->
        <div
          class="shrink-0 bg-linear-to-t from-black via-black/90 to-transparent px-4 sm:px-8 pb-6 pt-4"
        >
          <div class="max-w-3xl mx-auto space-y-2">
            <!-- Prompt -->
            <div class="flex items-start gap-3 group">
              <p class="text-white/90 text-sm leading-relaxed line-clamp-2 flex-1">
                "{{ currentItem.prompt }}"
              </p>
              <CopyButton
                :text="currentItem.prompt"
                class="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-white"
              />
            </div>

            <!-- Metadata Row -->
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
              <span class="capitalize">{{ currentItem.type }}</span>
              <span>{{ modeLabels[currentItem.mode] || currentItem.mode }}</span>
              <span>{{ formattedDate }}</span>
              <span v-if="currentItem.aspectRatio">{{ currentItem.aspectRatio }}</span>
              <span v-if="currentItem.resolution">{{ currentItem.resolution }}</span>
              <span v-if="currentItem.duration">{{ currentItem.duration }}s</span>
              <span v-if="currentItem.generationTimeMs" class="opacity-75">
                ({{ (currentItem.generationTimeMs / 1000).toFixed(1) }}s gen)
              </span>
            </div>

            <!-- Presets -->
            <div v-if="parsedPresets?.length" class="flex flex-wrap gap-1.5 pt-1">
              <UBadge
                v-for="preset in parsedPresets"
                :key="preset.name"
                color="primary"
                variant="subtle"
                size="xs"
                class="font-medium cursor-pointer hover:bg-primary/20 transition-colors"
                @click="handlePresetClick(preset.name)"
              >
                {{ preset.label }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
