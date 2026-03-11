<script setup lang="ts">
defineProps<{
  headshotUrl?: string | null
  fullBodyUrl?: string | null
  layout?: 'both' | 'headshot-only'
}>()
</script>

<template>
  <div v-if="headshotUrl || fullBodyUrl">
    <!-- Side-by-side layout -->
    <div v-if="layout === 'both'" class="flex items-end gap-4">
      <div
        v-if="headshotUrl"
        class="w-20 shrink-0 rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
      >
        <MediaPlayer :src="headshotUrl" type="image" alt="Headshot" />
      </div>
      <div
        v-if="fullBodyUrl"
        class="max-h-64 max-w-48 rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
      >
        <MediaPlayer :src="fullBodyUrl" type="image" alt="Full Body" />
      </div>
    </div>

    <!-- Headshot-only layout (sidebar) -->
    <div
      v-else
      class="max-w-24 mx-auto rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
    >
      <MediaPlayer :src="(headshotUrl || fullBodyUrl)!" type="image" alt="Person Preview" />
    </div>
  </div>
</template>
