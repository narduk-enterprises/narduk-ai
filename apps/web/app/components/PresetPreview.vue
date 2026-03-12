<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  headshotUrl?: string | null
  fullBodyUrl?: string | null
  layout?: 'both' | 'headshot-only'
}>()

const galleryViewer = useGalleryViewer()

const fallbackUrl = computed(() => props.headshotUrl || props.fullBodyUrl)

function openInViewer(url: string, alt: string) {
  const syntheticItem: Generation = {
    id: `preview-${alt}`,
    userId: '',
    type: 'image',
    mode: 't2i',
    prompt: alt,
    sourceGenerationId: null,
    status: 'done',
    xaiRequestId: null,
    r2Key: null,
    mediaUrl: url,
    thumbnailUrl: null,
    comparisonScore: 0,
    comparisonWins: 0,
    comparisonLosses: 0,
    lastComparedAt: null,
    duration: null,
    generationTimeMs: null,
    aspectRatio: null,
    resolution: null,
    metadata: null,
    presets: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  galleryViewer.open([syntheticItem], 0)
}
</script>

<template>
  <div v-if="headshotUrl || fullBodyUrl">
    <!-- Side-by-side layout -->
    <div v-if="layout === 'both'" class="flex items-end gap-4">
      <div
        v-if="headshotUrl"
        class="w-20 shrink-0 rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
        @click="openInViewer(headshotUrl!, 'Headshot')"
      >
        <NuxtImg
          :src="headshotUrl"
          alt="Headshot"
          class="size-full object-contain"
          loading="lazy"
        />
      </div>
      <div
        v-if="fullBodyUrl"
        class="max-h-64 max-w-48 rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
        @click="openInViewer(fullBodyUrl!, 'Full Body')"
      >
        <NuxtImg
          :src="fullBodyUrl"
          alt="Full Body"
          class="size-full object-contain"
          loading="lazy"
        />
      </div>
    </div>

    <!-- Headshot-only layout (sidebar) -->
    <div
      v-else-if="fallbackUrl"
      class="max-w-24 mx-auto rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
      @click="openInViewer(fallbackUrl, 'Person Preview')"
    >
      <NuxtImg
        :src="fallbackUrl"
        alt="Person Preview"
        class="size-full object-contain"
        loading="lazy"
      />
    </div>
  </div>
</template>
