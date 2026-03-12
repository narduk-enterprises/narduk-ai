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

const { deleteGeneration, remixing: remixingRef } = useGenerate()

const {
  handleUseAsSource: _handleUseAsSource,
  handleEditImage: _handleEditImage,
  handleUsePrompt: _handleUsePrompt,
  handleUpscale: _handleUpscale,
  handleRemix: _handleRemix,
} = useGalleryActions()

// ── Subcomponent Refs ──────────────────────────────────────
const imageViewerRef = ref<{
  resetZoom: () => void
  zoomIn: () => void
  zoomOut: () => void
  cancelSelectZoomMode: () => void
  toggleSelectZoomMode: () => void
} | null>(null)

const videoViewerRef = ref<{
  playVideo: () => void
  resetVideoState: () => void
  $el: HTMLElement
} | null>(null)

// ── Media Type Helpers ─────────────────────────────────────
const isVideo = computed(() => currentItem.value?.type === 'video')
const mediaUrl = computed(() => currentItem.value?.mediaUrl ?? '')
const isZoomed = ref(false)
const zoomLevel = ref(1)
const maxZoom = ref(8)
const isSelectZoomMode = ref(false)

function resetZoomState() {
  isZoomed.value = false
  zoomLevel.value = 1
  maxZoom.value = 8
  isSelectZoomMode.value = false
}

function handleZoomStateChange(state: {
  isZoomed: boolean
  zoomLevel: number
  maxZoom: number
  isSelectZoomMode: boolean
}) {
  isZoomed.value = state.isZoomed
  zoomLevel.value = state.zoomLevel
  maxZoom.value = state.maxZoom
  isSelectZoomMode.value = state.isSelectZoomMode
}

// ── Toolbar Actions (Delegated to specific functions below) ───

// ── Reset state when switching items ───────────────────────
watch(currentIndex, () => {
  resetZoomState()
  if (imageViewerRef.value) {
    imageViewerRef.value.resetZoom()
  }

  // Auto-play video on switch
  nextTick(() => {
    if (isVideo.value && videoViewerRef.value) {
      videoViewerRef.value.resetVideoState()
      videoViewerRef.value.playVideo()
    }
  })
})

// ── Auto-play on open & manage scroll lock ──────────────────
watch(isOpen, (open) => {
  if (open && isVideo.value) {
    nextTick(() => {
      if (videoViewerRef.value) {
        videoViewerRef.value.playVideo()
      }
    })
  }

  // Lock body scroll when open
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }

  if (!open) {
    resetZoomState()
  }
})

// ── Keyboard Navigation ───────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return

  if (e.key === 'Escape') {
    e.preventDefault()
    if (isSelectZoomMode.value && imageViewerRef.value) {
      imageViewerRef.value.cancelSelectZoomMode()
      return
    }
    if (isZoomed.value && imageViewerRef.value) {
      imageViewerRef.value.resetZoom()
    } else {
      close()
    }
    return
  }

  // Zoom controls
  if (e.key === '=' || e.key === '+') {
    e.preventDefault()
    if (imageViewerRef.value) imageViewerRef.value.zoomIn()
    return
  }
  if (e.key === '-') {
    e.preventDefault()
    if (imageViewerRef.value) imageViewerRef.value.zoomOut()
    return
  }
  if (e.key === '0') {
    e.preventDefault()
    if (imageViewerRef.value) imageViewerRef.value.resetZoom()
    return
  }

  if (isZoomed.value) return

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    next()
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    prev()
  } else if (e.key === ' ' && isVideo.value && videoViewerRef.value) {
    e.preventDefault()
    // togglePlay is not natively exposed on videoViewerRef unless we expose it
    const videoEl = videoViewerRef.value.$el.querySelector('video')
    if (videoEl) {
      if (videoEl.paused) videoViewerRef.value.playVideo()
      else videoEl.pause()
    }
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
    document.body.style.overflow = ''
  }
})

// ── Action Handlers ───────────────────────────────────────
function handleInfo() {
  if (!currentItem.value) return
  close()
  navigateTo(`/gallery/${currentItem.value.id}`)
}

async function handleRemix() {
  if (currentItem.value) await _handleRemix(currentItem.value)
}

function handleUseAsSource() {
  if (currentItem.value) _handleUseAsSource(currentItem.value)
}

function handleEditImage() {
  if (currentItem.value) _handleEditImage(currentItem.value)
}

function handleUsePrompt() {
  if (currentItem.value) _handleUsePrompt(currentItem.value)
}

async function handleUpscale() {
  if (currentItem.value) await _handleUpscale(currentItem.value)
}

async function handleDelete() {
  if (!currentItem.value) return
  const id = currentItem.value.id
  const idx = currentIndex.value
  await deleteGeneration(id)
  items.value = items.value.filter((g: Generation) => g.id !== id)
  if (items.value.length === 0) {
    close()
  } else {
    currentIndex.value = Math.min(idx, items.value.length - 1)
  }
}

function handleToggleSelectZoomMode() {
  imageViewerRef.value?.toggleSelectZoomMode()
}

function handlePresetClick(presetName: string) {
  close()
  navigateTo({ path: '/gallery', query: { search: presetName } })
}
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
      <div v-if="isOpen && currentItem" class="fixed inset-0 z-50 flex flex-col bg-black">
        <!-- Top Bar extracted -->
        <GalleryViewerToolbar
          :item="currentItem"
          :counter="counter"
          :loading-more="loadingMore"
          :is-zoomed="isZoomed"
          :zoom-level="zoomLevel"
          :max-zoom="maxZoom"
          :is-select-zoom-mode="isSelectZoomMode"
          :remixing="remixingRef"
          @close="close"
          @zoom-in="imageViewerRef?.zoomIn()"
          @zoom-out="imageViewerRef?.zoomOut()"
          @reset-zoom="imageViewerRef?.resetZoom()"
          @toggle-select-zoom-mode="handleToggleSelectZoomMode"
          @info="handleInfo"
          @use-as-source="handleUseAsSource"
          @edit-image="handleEditImage"
          @use-prompt="handleUsePrompt"
          @remix="handleRemix"
          @upscale="handleUpscale"
          @delete="handleDelete"
        />

        <!-- Main Media Area -->
        <GalleryViewerImage
          v-if="!isVideo && mediaUrl"
          ref="imageViewerRef"
          :item="currentItem"
          :media-url="mediaUrl"
          :has-next="hasNext"
          :has-prev="hasPrev"
          @zoom-state-change="handleZoomStateChange"
          @next="next"
          @prev="prev"
        />

        <GalleryViewerVideo
          v-else-if="isVideo && mediaUrl"
          ref="videoViewerRef"
          :item="currentItem"
          :media-url="mediaUrl"
          :has-next="hasNext"
          :has-prev="hasPrev"
          @next="next"
          @prev="prev"
        />

        <!-- Pending / Error States -->
        <div
          v-else-if="currentItem.status === 'pending'"
          class="flex flex-col items-center justify-center flex-1 gap-4"
        >
          <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
          <p class="text-white/60">Still generating...</p>
        </div>
        <div v-else class="flex flex-col items-center justify-center flex-1 gap-4">
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

        <!-- Bottom Info Panel extracted -->
        <GalleryViewerMetadata :item="currentItem" @preset-click="handlePresetClick" />
      </div>
    </Transition>
  </Teleport>
</template>
