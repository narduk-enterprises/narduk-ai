<script setup lang="ts">
import type { Generation } from '~/types/generation'
import { formatComparisonScore } from '~/utils/imageCompare'

const props = defineProps<{
  open: boolean
  title: string
  images: Generation[]
  loading?: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'update:searchQuery': [value: string]
  select: [generation: Generation]
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value),
})

function getScoreLabel(image: Generation) {
  return String(formatComparisonScore(image.comparisonScore))
}

function handleSelect(image: Generation) {
  emit('select', image)
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :ui="{
      content: 'sm:max-w-5xl flex flex-col h-[85vh] sm:h-[760px] overflow-hidden bg-default',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-display text-lg font-semibold">{{ title }}</h2>
          <p class="text-sm text-muted">Only completed images are eligible.</p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="openModel = false"
        />
      </div>
    </template>

    <template #body>
      <div class="flex h-full flex-col gap-4">
        <UInput
          v-model="searchModel"
          icon="i-lucide-search"
          placeholder="Search by prompt..."
          class="w-full shrink-0"
        />

        <div v-if="loading" class="flex flex-1 items-center justify-center">
          <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        </div>

        <div
          v-else-if="!images.length"
          class="flex flex-1 flex-col items-center justify-center gap-3 text-center"
        >
          <UIcon name="i-lucide-image-off" class="size-10 text-dimmed" />
          <div>
            <p class="font-medium text-default">No matching images</p>
            <p class="mt-1 text-sm text-muted">Try a different search or choose another image.</p>
          </div>
        </div>

        <div
          v-else
          class="grid flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto p-1 md:grid-cols-4"
        >
          <div
            v-for="image in images"
            :key="image.id"
            :data-testid="`compare-candidate-${image.id}`"
            role="button"
            tabindex="0"
            class="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-default bg-elevated/40 text-left transition hover:-translate-y-0.5 hover:border-primary/40 focus:outline-none focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
            @click="handleSelect(image)"
            @keydown.enter.prevent="handleSelect(image)"
            @keydown.space.prevent="handleSelect(image)"
          >
            <div class="aspect-square w-full overflow-hidden bg-elevated/60">
              <MediaImg
                :src="image.mediaUrl || ''"
                :alt="image.prompt"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div class="flex flex-col gap-2 p-3">
              <ExpandableText
                :text="image.prompt"
                :collapsed-lines="2"
                text-class="text-xs leading-relaxed text-default"
                button-class="text-xs"
              />
              <div class="flex items-center justify-between gap-2">
                <UBadge
                  color="primary"
                  variant="subtle"
                  size="xs"
                  icon="i-lucide-trophy"
                  :label="getScoreLabel(image)"
                />
                <span class="text-[11px] text-dimmed">
                  {{ image.comparisonWins }}W / {{ image.comparisonLosses }}L
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
