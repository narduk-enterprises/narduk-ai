<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  generations: Generation[]
  loading?: boolean
  loadingMore?: boolean
  isFinished?: boolean
}>()

const emit = defineEmits<{
  (e: 'click' | 'use-as-source' | 'use-prompt' | 'upscale' | 'compare', gen: Generation): void
  (e: 'load-more'): void
}>()

function isLandscape(gen: Generation): boolean {
  if (!gen.aspectRatio) return false
  const parts = gen.aspectRatio.split(':').map(Number)
  return (
    parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined && parts[0] > parts[1]
  )
}

// Infinite scroll sentinel
const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]: IntersectionObserverEntry[]) => {
      if (entry?.isIntersecting && !props.loadingMore && !props.isFinished) {
        emit('load-more')
      }
    },
    { rootMargin: '200px' },
  )
})

watch(sentinelEl, (el, oldEl) => {
  if (oldEl && observer) observer.unobserve(oldEl)
  if (el && observer) observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="space-y-4 min-w-0 overflow-hidden">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-display font-semibold">Recent</h2>
      <UButton variant="link" to="/gallery" size="sm" trailing-icon="i-lucide-arrow-right">
        View All
      </UButton>
    </div>

    <!-- Skeleton loading state (first load, no items yet) -->
    <div v-if="loading && !generations.length" class="flex gap-4 overflow-hidden">
      <div
        v-for="n in 5"
        :key="n"
        class="h-48 sm:h-56 shrink-0 rounded-xl bg-elevated/50 animate-pulse ring-1 ring-default/10"
        :class="n % 3 === 0 ? 'w-64 sm:w-72' : 'w-36 sm:w-40'"
      />
    </div>

    <!-- Empty state (loaded, zero items) -->
    <div
      v-else-if="!loading && !generations.length"
      class="flex flex-col items-center justify-center gap-3 py-8 glass-card text-center"
    >
      <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <UIcon name="i-lucide-sparkles" class="size-6 text-primary/50" />
      </div>
      <p class="text-sm text-muted">Your creations will appear here</p>
    </div>

    <!-- Carousel with items -->
    <template v-else>
      <UCarousel
        v-slot="{ item }"
        :items="generations"
        :ui="{
          root: 'overflow-hidden w-full',
          item: 'min-w-0 shrink-0 grow-0 basis-auto ps-4',
          container: 'flex items-start -ms-4',
        }"
        wheel-gestures
        arrows
        class="w-full"
      >
        <div
          class="group relative h-48 sm:h-56 overflow-hidden rounded-xl bg-elevated/50 cursor-pointer ring-1 ring-default/10 hover:ring-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
          :class="isLandscape(item) ? 'w-64 sm:w-72' : 'w-36 sm:w-40'"
          :data-generation-id="item.id"
          @click="emit('click', item)"
        >
          <template v-if="item.status === 'done' && item.mediaUrl">
            <MediaImg
              v-if="item.type === 'image'"
              :src="item.mediaUrl"
              :alt="item.prompt"
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <DeferredVideo
              :src="item.mediaUrl"
              :poster="item.thumbnailUrl || undefined"
              video-class="h-full w-full object-cover"
            />
          </template>
          <div v-else class="flex h-full w-full items-center justify-center">
            <UIcon
              v-if="item.status === 'pending'"
              name="i-lucide-loader-2"
              class="size-6 animate-spin text-primary"
            />
            <UIcon
              v-else-if="item.status === 'failed'"
              name="i-lucide-alert-triangle"
              class="size-6 text-error"
            />
            <UIcon v-else name="i-lucide-clock" class="size-6 text-muted" />
          </div>

          <!-- Gradient overlay on hover -->
          <div
            class="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          />

          <!-- Type badge -->
          <UBadge
            :color="item.type === 'video' ? 'info' : 'primary'"
            variant="solid"
            size="xs"
            class="absolute left-1.5 top-1.5"
            :icon="item.type === 'video' ? 'i-lucide-video' : 'i-lucide-image'"
          />

          <!-- Hover actions -->
          <div
            class="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <UButton
              v-if="item.status === 'done'"
              size="xs"
              variant="solid"
              color="neutral"
              icon="i-lucide-file-text"
              class="rounded-full backdrop-blur-sm bg-black/40 hover:bg-black/60 border-0"
              @click.stop="emit('use-prompt', item)"
            />
            <UButton
              v-if="item.type === 'image' && item.status === 'done'"
              size="xs"
              variant="solid"
              color="neutral"
              icon="i-lucide-scale"
              class="rounded-full backdrop-blur-sm bg-black/40 hover:bg-black/60 border-0"
              aria-label="Compare recent image"
              @click.stop="emit('compare', item)"
            />
            <UButton
              v-if="item.type === 'image' && item.status === 'done'"
              size="xs"
              variant="solid"
              color="neutral"
              icon="i-lucide-wand-2"
              class="rounded-full backdrop-blur-sm bg-black/40 hover:bg-black/60 border-0"
              @click.stop="emit('use-as-source', item)"
            />
            <UButton
              v-if="item.type === 'image' && item.status === 'done'"
              size="xs"
              variant="solid"
              color="neutral"
              icon="i-lucide-maximize-2"
              class="rounded-full backdrop-blur-sm bg-black/40 hover:bg-black/60 border-0"
              @click.stop="emit('upscale', item)"
            />
          </div>
        </div>
      </UCarousel>

      <!-- Load-more sentinel + spinner (placed after carousel but still in the scroll flow) -->
      <div class="flex items-center justify-center h-8">
        <div v-if="loadingMore" class="flex items-center gap-2 text-muted text-xs">
          <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
          <span>Loading more…</span>
        </div>
        <!-- Invisible sentinel for IntersectionObserver -->
        <div v-else-if="!isFinished" ref="sentinelEl" class="w-px h-px" />
        <p v-else class="text-xs text-dimmed uppercase tracking-widest flex items-center gap-1.5">
          <UIcon name="i-lucide-check-circle-2" class="size-3.5" /> All caught up
        </p>
      </div>
    </template>
  </div>
</template>
