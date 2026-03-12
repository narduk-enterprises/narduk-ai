<script setup lang="ts">
import { formatComparisonScore } from '~/utils/imageCompare'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Compare Images — Narduk AI',
  description: 'Compare two completed gallery images and store which one wins.',
})
useWebPageSchema({
  name: 'Compare Images — Narduk AI',
  description: 'Compare two completed gallery images and store which one wins.',
})

const {
  leftImage,
  rightImage,
  pairComparison,
  recentResult,
  loadingLeft,
  loadingRight,
  loadingPair,
  savingVote,
  canVote,
  pickerTarget,
  isPickerOpen,
  candidateSearch,
  candidateImages,
  loadingCandidates,
  openPicker,
  closePicker,
  selectCandidate,
  clearRightImage,
  submitVote,
  clearRecentResult,
} = useImageCompare()

const leftState = computed(() => {
  if (!pairComparison.value || !leftImage.value || !rightImage.value) return 'default'
  return pairComparison.value.winnerGenerationId === leftImage.value.id ? 'winner' : 'loser'
})

const rightState = computed(() => {
  if (!pairComparison.value || !leftImage.value || !rightImage.value) return 'default'
  return pairComparison.value.winnerGenerationId === rightImage.value.id ? 'winner' : 'loser'
})

const pairWinner = computed(() => {
  if (!pairComparison.value || !leftImage.value || !rightImage.value) return null
  return pairComparison.value.winnerGenerationId === leftImage.value.id
    ? leftImage.value
    : rightImage.value
})

const pairLoser = computed(() => {
  if (!pairComparison.value || !leftImage.value || !rightImage.value) return null
  return pairComparison.value.loserGenerationId === leftImage.value.id
    ? leftImage.value
    : rightImage.value
})

const pickerTitle = computed(() =>
  pickerTarget.value === 'left' ? 'Choose Image A' : 'Choose Image B',
)
const primaryPickerTarget = computed<'left' | 'right'>(() => (leftImage.value ? 'right' : 'left'))
const primaryPickerLabel = computed(() =>
  leftImage.value ? 'Choose Challenger' : 'Choose Anchor Image',
)

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return target.closest('input, textarea, [contenteditable="true"], [role="textbox"]') !== null
}

function handleKeydown(event: KeyboardEvent) {
  if (!canVote.value || savingVote.value || isPickerOpen.value || isEditableTarget(event.target)) {
    return
  }

  const key = event.key.toLowerCase()
  if (key === 'a' && leftImage.value) {
    event.preventDefault()
    submitVote(leftImage.value.id)
  }

  if (key === 'b' && rightImage.value) {
    event.preventDefault()
    submitVote(rightImage.value.id)
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div class="pointer-events-none absolute inset-x-0 top-0 h-72 gradient-mesh opacity-60" />

    <div class="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compare</p>
          <h1 class="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Pick the stronger image
          </h1>
          <p class="mt-3 text-base leading-relaxed text-muted">
            Every saved winner updates a hidden ranking score, so your gallery can surface the
            strongest images later.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-images"
            class="rounded-full"
            to="/gallery"
          >
            Back to Gallery
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            class="rounded-full"
            @click="openPicker(primaryPickerTarget)"
          >
            {{ primaryPickerLabel }}
          </UButton>
        </div>
      </div>

      <div
        v-if="recentResult"
        class="glass-card flex flex-col gap-3 border-success/30 bg-success/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-semibold text-success">Saved</p>
          <p class="mt-1 text-sm text-default">
            {{ recentResult.winner.prompt }} now ranks above {{ recentResult.loser.prompt }}.
          </p>
          <p class="mt-1 text-xs text-muted">
            Score {{ formatComparisonScore(recentResult.winner.comparisonScore) }} vs
            {{ formatComparisonScore(recentResult.loser.comparisonScore) }}
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="self-start rounded-full sm:self-auto"
          @click="clearRecentResult"
        >
          Dismiss
        </UButton>
      </div>

      <div
        v-else-if="pairComparison && pairWinner && pairLoser"
        class="glass-card flex flex-col gap-3 border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-semibold text-warning">Already compared</p>
          <p class="mt-1 text-sm text-default">
            {{ pairWinner.prompt }} already beats {{ pairLoser.prompt }} for this pair.
          </p>
          <p class="mt-1 text-xs text-muted">Choose another challenger to keep ranking Image A.</p>
        </div>
        <UButton
          color="warning"
          variant="soft"
          icon="i-lucide-refresh-cw"
          class="self-start rounded-full sm:self-auto"
          @click="clearRightImage"
        >
          Choose Another Challenger
        </UButton>
      </div>

      <div
        v-if="!leftImage && !loadingLeft"
        class="glass-card flex flex-col items-center gap-5 py-20 text-center"
      >
        <div class="flex size-16 items-center justify-center rounded-3xl bg-primary/10">
          <UIcon name="i-lucide-scale" class="size-8 text-primary" />
        </div>
        <div class="max-w-md">
          <h2 class="font-display text-2xl font-semibold">Start with Image A</h2>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            Pick any completed image from your gallery. You can reach this page directly from a
            card, the viewer, the detail page, or the recent carousel.
          </p>
        </div>
        <UButton
          color="primary"
          icon="i-lucide-image-plus"
          class="rounded-full"
          @click="openPicker('left')"
        >
          Choose Anchor Image
        </UButton>
      </div>

      <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CompareImageCard
          label="Image A"
          :generation="leftImage"
          :loading="loadingLeft"
          :state="leftState"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-repeat"
              class="rounded-full"
              @click="openPicker('left')"
            >
              Change Image A
            </UButton>

            <UButton
              v-if="leftImage && rightImage && !pairComparison"
              color="primary"
              icon="i-lucide-trophy"
              class="rounded-full"
              :loading="savingVote"
              :disabled="savingVote || loadingPair"
              @click="submitVote(leftImage.id)"
            >
              Pick Image A
            </UButton>

            <div
              v-if="leftImage && rightImage && !pairComparison"
              class="flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-xs text-muted"
            >
              <span>Shortcut</span>
              <UKbd>A</UKbd>
            </div>
          </template>
        </CompareImageCard>

        <CompareImageCard
          label="Image B"
          :generation="rightImage"
          :loading="loadingRight"
          :state="rightState"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="outline"
              :icon="rightImage ? 'i-lucide-repeat' : 'i-lucide-image-plus'"
              class="rounded-full"
              @click="openPicker('right')"
            >
              {{ rightImage ? 'Change Image B' : 'Choose Image B' }}
            </UButton>

            <UButton
              v-if="leftImage && rightImage && !pairComparison"
              color="primary"
              icon="i-lucide-trophy"
              class="rounded-full"
              :loading="savingVote"
              :disabled="savingVote || loadingPair"
              @click="submitVote(rightImage.id)"
            >
              Pick Image B
            </UButton>

            <div
              v-if="leftImage && rightImage && !pairComparison"
              class="flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-xs text-muted"
            >
              <span>Shortcut</span>
              <UKbd>B</UKbd>
            </div>
          </template>
        </CompareImageCard>
      </div>

      <div
        v-if="leftImage"
        class="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-medium text-default">
            {{
              canVote
                ? 'Pick the better image. One click stores the winner and updates both scores.'
                : rightImage
                  ? 'This pair already has a saved winner.'
                  : 'Choose a challenger to vote on this anchor image.'
            }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Only completed images can be compared. Rankings update automatically with no extra
            input.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-grid-3x3"
            class="rounded-full"
            to="/gallery?sort=rank"
          >
            View Ranked Gallery
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            class="rounded-full"
            @click="openPicker('right')"
          >
            {{ rightImage ? 'Swap Challenger' : 'Choose Challenger' }}
          </UButton>
        </div>
      </div>
    </div>

    <ComparePickerModal
      :open="isPickerOpen"
      :title="pickerTitle"
      :images="candidateImages"
      :loading="loadingCandidates"
      :search-query="candidateSearch"
      @update:open="(open) => !open && closePicker()"
      @update:search-query="candidateSearch = $event"
      @select="selectCandidate"
    />
  </div>
</template>
