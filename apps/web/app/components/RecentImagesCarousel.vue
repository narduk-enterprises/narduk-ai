<script setup lang="ts">
import type { Generation } from '~/types/generation'

defineProps<{
  generations: Generation[]
}>()

const emit = defineEmits<{
  (e: 'click' | 'use-as-source' | 'upscale', gen: Generation): void
}>()

function isLandscape(gen: Generation): boolean {
  if (!gen.aspectRatio) return false
  const parts = gen.aspectRatio.split(':').map(Number)
  return (
    parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined && parts[0] > parts[1]
  )
}
</script>

<template>
  <div v-if="generations.length" class="space-y-4 min-w-0">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-display font-semibold">Recent</h2>
      <UButton variant="link" to="/gallery" size="sm" trailing-icon="i-lucide-arrow-right">
        View All
      </UButton>
    </div>
    <UCarousel
      v-slot="{ item }"
      :items="generations"
      :ui="{
        item: 'min-w-0 shrink-0 grow-0 basis-auto ps-4',
        container: 'flex items-start -ms-4',
      }"
      arrows
      class="w-full"
    >
      <div
        class="group relative h-48 sm:h-56 overflow-hidden rounded-xl bg-elevated/50 cursor-pointer ring-1 ring-default/10 hover:ring-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
        :class="isLandscape(item) ? 'w-64 sm:w-72' : 'w-36 sm:w-40'"
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
          <video
            v-else
            :src="item.mediaUrl"
            loop
            muted
            playsinline
            class="h-full w-full object-cover"
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
  </div>
</template>
