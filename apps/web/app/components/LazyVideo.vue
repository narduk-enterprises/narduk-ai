<script setup lang="ts">
/**
 * LazyVideo – only sets the video `src` when the element enters the viewport.
 *
 * Shows a poster image with a play-icon overlay when the video isn't loaded yet.
 * If no poster is provided, shows a dark placeholder with a play icon.
 */
const props = defineProps<{
  src: string
  poster?: string
  /** CSS classes applied to the <video> element */
  videoClass?: string
  /** Show thumbnail poster only — never loads the actual video. Good for compact grid. */
  posterOnly?: boolean
}>()

const containerRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const activeSrc = computed(() => {
  if (props.posterOnly || !isVisible.value) return
  return props.src
})

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (props.posterOnly || !containerRef.value) return
  observer = new IntersectionObserver(
    ([entry]: IntersectionObserverEntry[]) => {
      if (entry?.isIntersecting) {
        isVisible.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: '200px' },
  )
  observer.observe(containerRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <!-- Show poster image if available and video not yet loaded -->
    <template v-if="poster && (!isVisible || posterOnly)">
      <img :src="poster" :alt="'Video thumbnail'" :class="videoClass" loading="lazy" />
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="size-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <UIcon name="i-lucide-play" class="size-5 text-white ml-0.5" />
        </div>
      </div>
    </template>

    <!-- Placeholder when no poster and video not loaded -->
    <template v-else-if="!isVisible || posterOnly">
      <div :class="[videoClass, 'bg-elevated/80 flex items-center justify-center']">
        <div class="size-10 rounded-full bg-black/30 flex items-center justify-center">
          <UIcon name="i-lucide-play" class="size-5 text-white/70 ml-0.5" />
        </div>
      </div>
    </template>

    <!-- Actual video element once visible -->
    <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
    <video
      v-else
      :src="activeSrc"
      :poster="poster || undefined"
      preload="none"
      loop
      muted
      playsinline
      :class="videoClass"
    />
  </div>
</template>
