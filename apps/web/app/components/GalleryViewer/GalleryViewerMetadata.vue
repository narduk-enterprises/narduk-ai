<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  item: Generation
}>()

defineEmits<{
  presetClick: [string]
}>()

// Mode Labels
const modeLabels: Record<string, string> = {
  t2i: 'Text → Image',
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  i2i: 'Image → Image',
}

const formattedDate = computed(() => {
  if (!props.item) return ''
  return new Date(props.item.createdAt).toLocaleString()
})

const parsedPresets = computed(() => {
  if (!props.item?.presets) return null
  try {
    const raw = JSON.parse(props.item.presets) as Record<string, string>
    return Object.entries(raw)
      .filter(([_, val]) => Boolean(val))
      .map(([key, val]) => ({
        type: key,
        name: val,
        label: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`,
      }))
  } catch {
    return null
  }
})
</script>

<template>
  <div
    class="shrink-0 bg-linear-to-t from-black via-black/90 to-transparent px-4 sm:px-8 pb-6 pt-4"
  >
    <div class="max-w-3xl mx-auto space-y-2">
      <!-- Prompt -->
      <div class="flex items-start gap-3 group">
        <p class="text-white/90 text-sm leading-relaxed line-clamp-2 flex-1">"{{ item.prompt }}"</p>
        <CopyButton
          :text="item.prompt"
          class="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-white"
        />
      </div>

      <!-- Metadata Row -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
        <span class="capitalize">{{ item.type }}</span>
        <span>{{ modeLabels[item.mode] || item.mode }}</span>
        <span>{{ formattedDate }}</span>
        <span v-if="item.aspectRatio">{{ item.aspectRatio }}</span>
        <span v-if="item.resolution">{{ item.resolution }}</span>
        <span v-if="item.duration">{{ item.duration }}s</span>
        <span v-if="item.generationTimeMs" class="opacity-75">
          ({{ (item.generationTimeMs / 1000).toFixed(1) }}s gen)
        </span>
      </div>

      <!-- Presets -->
      <div v-if="parsedPresets?.length" class="flex flex-wrap gap-1.5 pt-1">
        <UBadge
          v-for="preset in parsedPresets"
          :key="preset.name"
          color="primary"
          variant="subtle"
          size="xs"
          class="font-medium cursor-pointer hover:bg-primary/20 transition-colors"
          @click="$emit('presetClick', preset.name)"
        >
          {{ preset.label }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
