<script setup lang="ts">
import type { Generation } from '~/types/generation'
import { formatComparisonScore } from '~/utils/imageCompare'

defineProps<{
  label: string
  kbd: string
  generation: Generation
  voting?: boolean
}>()

const emit = defineEmits<{
  vote: [id: string]
}>()
</script>

<template>
  <div
    class="glass-card group relative flex cursor-pointer flex-col gap-4 overflow-hidden p-4 transition-all duration-150 hover:ring-2 hover:ring-primary/40"
    :class="{ 'pointer-events-none opacity-60': voting }"
    @click="emit('vote', generation.id)"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{{
          label
        }}</span>
        <UKbd>{{ kbd }}</UKbd>
      </div>
      <span class="text-xs text-muted">Click or press {{ kbd }}</span>
    </div>
    <div class="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-elevated">
      <img
        :src="generation.mediaUrl || ''"
        :alt="generation.prompt"
        class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
      />
    </div>
    <p class="line-clamp-2 text-xs text-muted">{{ generation.prompt }}</p>
    <p class="text-xs text-dimmed">
      Score: {{ formatComparisonScore(generation.comparisonScore) }} ({{ generation.comparisonWins
      }}W / {{ generation.comparisonLosses }}L)
    </p>
  </div>
</template>
