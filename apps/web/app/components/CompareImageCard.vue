<script setup lang="ts">
import type { Generation } from '~/types/generation'
import { formatComparisonScore } from '~/utils/imageCompare'

const props = defineProps<{
  label: string
  generation: Generation | null
  loading?: boolean
  state?: 'default' | 'winner' | 'loser'
}>()

const stateConfig = computed(() => {
  if (props.state === 'winner') {
    return {
      badgeColor: 'success' as const,
      badgeLabel: 'Winner',
      panelClass: 'ring-1 ring-success/30',
    }
  }

  if (props.state === 'loser') {
    return {
      badgeColor: 'warning' as const,
      badgeLabel: 'Runner-up',
      panelClass: 'ring-1 ring-warning/25',
    }
  }

  return {
    badgeColor: 'neutral' as const,
    badgeLabel: null,
    panelClass: '',
  }
})
</script>

<template>
  <div class="glass-card p-4 sm:p-5 h-full flex flex-col gap-4" :class="stateConfig.panelClass">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-dimmed">{{ label }}</p>
        <p class="mt-1 text-sm text-muted">
          {{ generation ? 'Completed image' : 'Select an image to continue' }}
        </p>
      </div>
      <UBadge
        v-if="stateConfig.badgeLabel"
        :color="stateConfig.badgeColor"
        variant="subtle"
        size="sm"
        :label="stateConfig.badgeLabel"
      />
    </div>

    <div
      v-if="loading"
      class="flex min-h-[18rem] flex-1 items-center justify-center rounded-2xl bg-elevated/60"
    >
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
    </div>

    <template v-else-if="generation">
      <div class="overflow-hidden rounded-2xl bg-elevated/60 aspect-[4/5]">
        <MediaImg
          :src="generation.mediaUrl || ''"
          :alt="generation.prompt"
          class="h-full w-full object-cover"
        />
      </div>

      <div class="space-y-3">
        <ExpandableText
          :text="generation.prompt"
          :collapsed-lines="3"
          text-class="text-sm leading-relaxed text-default"
          button-class="text-xs"
        />

        <div class="flex flex-wrap gap-2">
          <UBadge
            color="primary"
            variant="subtle"
            size="sm"
            icon="i-lucide-trophy"
            :label="`Score ${formatComparisonScore(generation.comparisonScore)}`"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="`${generation.comparisonWins} wins`"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="`${generation.comparisonLosses} losses`"
          />
        </div>
      </div>
    </template>

    <div
      v-else
      class="flex min-h-[18rem] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-default bg-elevated/40 px-5 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <UIcon name="i-lucide-images" class="size-6 text-primary" />
      </div>
      <div>
        <p class="font-medium text-default">No image selected</p>
        <p class="mt-1 text-sm text-muted">Pick a completed gallery image.</p>
      </div>
    </div>

    <div class="mt-auto flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
