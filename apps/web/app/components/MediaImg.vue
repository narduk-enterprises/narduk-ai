<script setup lang="ts">
defineOptions({ inheritAttrs: false })
/**
 * MediaImg — wrapper for API-served images (R2 media).
 *
 * In production, uses NuxtImg with the Cloudflare provider for edge
 * optimization (WebP, resize). In dev, falls back to a plain <img>
 * because IPX cannot serve dynamic /api/ routes (IPX_FILE_NOT_FOUND).
 */
defineProps<{
  src: string
  alt?: string
  class?: string | string[] | Record<string, boolean>
  loading?: 'lazy' | 'eager'
  width?: number | string
  height?: number | string
}>()

const isDev = import.meta.dev
</script>

<template>
  <!-- eslint-disable narduk/no-native-img -- Dev fallback for API-served R2 media that IPX cannot serve -->
  <img
    v-if="isDev"
    :src="src"
    :alt="alt"
    :class="$props.class"
    :loading="loading"
    :width="width"
    :height="height"
  />
  <!-- eslint-enable narduk/no-native-img -->
  <NuxtImg
    v-else
    :src="src"
    :alt="alt"
    :class="$props.class"
    :loading="loading"
    :width="width"
    :height="height"
    placeholder
  />
</template>
