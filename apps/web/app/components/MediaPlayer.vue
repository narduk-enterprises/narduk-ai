<script setup lang="ts">
defineProps<{
  src: string
  type: 'image' | 'video'
  alt?: string
}>()

const isZoomed = ref(false)
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl neon-border bg-elevated/30">
    <template v-if="type === 'image'">
      <!-- Base Image -->
      <img
        :src="src"
        :alt="alt || 'Generated image'"
        class="max-h-[60vh] w-full object-contain cursor-zoom-in transition-transform duration-300 hover:scale-[1.02]"
        @click="isZoomed = true"
      />

      <!-- Zoom Modal -->
      <UModal v-model="isZoomed" fullscreen :ui="{ base: 'bg-black/95' }">
        <div class="relative h-full w-full flex items-center justify-center p-4">
          <UButton
            icon="i-lucide-x"
            color="white"
            variant="ghost"
            class="absolute top-4 right-4 z-50 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md"
            size="xl"
            @click="isZoomed = false"
          />
          <img
            :src="src"
            :alt="alt || 'Zoomed generated image'"
            class="max-h-[90vh] max-w-full object-contain"
            @click="isZoomed = false"
          />
        </div>
      </UModal>
    </template>
    <template v-else>
      <video :src="src" controls class="max-h-[60vh] w-full bg-black" preload="metadata">
        Your browser does not support the video tag.
      </video>
    </template>
  </div>
</template>
