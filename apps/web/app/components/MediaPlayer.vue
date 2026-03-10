<script setup lang="ts">
const _props = defineProps<{
  src: string
  type: 'image' | 'video'
  alt?: string
}>()
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl neon-border bg-elevated/30">
    <img v-if="type === 'image'" :src="src" :alt="alt || 'Generated media'" class="h-auto w-full" />
    <video v-else :src="src" controls class="h-auto w-full" preload="metadata">
      Your browser does not support the video tag.
    </video>
  </div>
</template>
