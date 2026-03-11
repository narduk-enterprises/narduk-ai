<script setup lang="ts">
import type { Generation } from '~/types/generation'

defineProps<{
  generations: Generation[]
}>()

const emit = defineEmits<{
  (e: 'click' | 'use-as-source' | 'upscale', gen: Generation): void
}>()
</script>

<template>
  <div v-if="generations.length" class="space-y-4">
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
        item: 'basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 pl-3',
        container:
          'flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar -ml-3 py-2',
      }"
      arrows
      class="w-full"
    >
      <GenerationCard
        :generation="item"
        class="h-full"
        @click="emit('click', item)"
        @use-as-source="emit('use-as-source', item)"
        @upscale="emit('upscale', item)"
      />
    </UCarousel>
  </div>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
