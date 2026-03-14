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

// ─── Manual Compare Mode ─────────────────────────────────────
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

// ─── Arena Mode ──────────────────────────────────────────────
const {
  arenaActive,
  currentPair,
  arenaStats,
  arenaComplete,
  progressPercent,
  loading: arenaLoading,
  voting: arenaVoting,
  batches,
  loadingBatches,
  loadBatches,
  startArena,
  submitArenaVote,
  skipPair,
  exitArena,
  generating,
  generatingStatus,
  generateBatch,
} = useArena()

const batchCount = ref(10)
const batchPrompt = ref('Full body, standing, hands on hips, 20-30 years old, white woman')

function startBatchGeneration() {
  showBatchPicker.value = false
  generateBatch(batchCount.value, undefined, batchPrompt.value)
}

const showBatchPicker = ref(false)

async function openBatchPicker() {
  await loadBatches()
  showBatchPicker.value = true
}

async function selectBatch(batchId: string) {
  showBatchPicker.value = false
  await startArena(batchId)
}

async function startAllArena() {
  showBatchPicker.value = false
  await startArena()
}

// ─── Manual Compare State ────────────────────────────────────
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

// ─── Keyboard Shortcuts ──────────────────────────────────────
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return target.closest('input, textarea, [contenteditable="true"], [role="textbox"]') !== null
}

function handleKeydown(event: KeyboardEvent) {
  if (isEditableTarget(event.target)) return

  const key = event.key.toLowerCase()

  // Arena mode shortcuts
  if (arenaActive.value && currentPair.value && !arenaVoting.value) {
    if (key === 'a') {
      event.preventDefault()
      submitArenaVote(currentPair.value.left.id)
    }
    if (key === 'b') {
      event.preventDefault()
      submitArenaVote(currentPair.value.right.id)
    }
    if (key === 's') {
      event.preventDefault()
      skipPair()
    }
    return
  }

  // Manual mode shortcuts
  if (!canVote.value || savingVote.value || isPickerOpen.value) return

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
      <!-- Header -->
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {{ arenaActive ? 'Arena Mode' : 'Compare' }}
          </p>
          <h1 class="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {{ arenaActive ? 'Rapid-Fire Arena' : 'Pick the stronger image' }}
          </h1>
          <p class="mt-3 text-base leading-relaxed text-muted">
            {{
              arenaActive
                ? 'Auto-loaded pairs — vote with A/B keys, skip with S. Scores update automatically.'
                : 'Every saved winner updates a hidden ranking score, so your gallery can surface the strongest images later.'
            }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="arenaActive"
            color="neutral"
            variant="outline"
            icon="i-lucide-x"
            class="rounded-full"
            @click="exitArena"
          >
            Exit Arena
          </UButton>
          <UButton
            v-if="!arenaActive"
            color="neutral"
            variant="outline"
            icon="i-lucide-images"
            class="rounded-full"
            to="/gallery"
          >
            Back to Gallery
          </UButton>
          <UButton
            v-if="!arenaActive"
            color="neutral"
            variant="outline"
            icon="i-lucide-swords"
            class="rounded-full"
            @click="openBatchPicker"
          >
            Arena Mode
          </UButton>
          <UButton
            v-if="!arenaActive"
            color="primary"
            icon="i-lucide-plus"
            class="rounded-full"
            @click="openPicker(primaryPickerTarget)"
          >
            {{ primaryPickerLabel }}
          </UButton>
        </div>
      </div>

      <!-- ═══════════════ Arena Mode ═══════════════ -->
      <template v-if="arenaActive">
        <!-- Progress Bar -->
        <div class="glass-card flex flex-col gap-3 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-swords" class="size-5 text-primary" />
              <span class="text-sm font-semibold text-default">
                {{ arenaStats.completed }} / {{ arenaStats.totalPairs }} pairs
              </span>
              <span v-if="arenaStats.skipped > 0" class="text-xs text-muted">
                ({{ arenaStats.skipped }} skipped)
              </span>
            </div>
            <span class="text-sm font-medium text-primary">{{ progressPercent }}%</span>
          </div>
          <UProgress :model-value="progressPercent" color="primary" size="sm" />
        </div>

        <!-- Arena Loading -->
        <div
          v-if="arenaLoading"
          class="glass-card flex flex-col items-center gap-5 py-20 text-center"
        >
          <div class="flex size-16 items-center justify-center rounded-3xl bg-primary/10">
            <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
          </div>
          <p class="text-sm text-muted">Loading arena pairs...</p>
        </div>

        <!-- Arena Complete -->
        <div
          v-else-if="arenaComplete"
          class="glass-card flex flex-col items-center gap-5 py-20 text-center"
        >
          <div class="flex size-16 items-center justify-center rounded-3xl bg-success/10">
            <UIcon name="i-lucide-trophy" class="size-8 text-success" />
          </div>
          <div class="max-w-md">
            <h2 class="font-display text-2xl font-semibold">Arena Complete! 🏆</h2>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              All {{ arenaStats.totalPairs }} pairs have been compared. Check the ranked gallery to
              see the winners.
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-grid-3x3"
              class="rounded-full"
              to="/gallery?sort=rank"
            >
              View Rankings
            </UButton>
            <UButton color="primary" icon="i-lucide-x" class="rounded-full" @click="exitArena">
              Exit Arena
            </UButton>
          </div>
        </div>

        <!-- Arena Pair Display -->
        <div v-else-if="currentPair" class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <!-- Image A -->
          <div class="glass-card group relative flex flex-col gap-4 overflow-hidden p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                  >A</span
                >
                <UKbd>A</UKbd>
              </div>
              <UButton
                color="primary"
                icon="i-lucide-trophy"
                class="rounded-full"
                :loading="arenaVoting"
                :disabled="arenaVoting"
                @click="submitArenaVote(currentPair.left.id)"
              >
                Pick A
              </UButton>
            </div>
            <div class="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-elevated">
              <img
                :src="currentPair.left.mediaUrl || ''"
                :alt="currentPair.left.prompt"
                class="size-full object-cover"
              />
            </div>
            <p class="line-clamp-2 text-xs text-muted">{{ currentPair.left.prompt }}</p>
            <p class="text-xs text-dimmed">
              Score: {{ formatComparisonScore(currentPair.left.comparisonScore) }} ({{
                currentPair.left.comparisonWins
              }}W / {{ currentPair.left.comparisonLosses }}L)
            </p>
          </div>

          <!-- Image B -->
          <div class="glass-card group relative flex flex-col gap-4 overflow-hidden p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                  >B</span
                >
                <UKbd>B</UKbd>
              </div>
              <UButton
                color="primary"
                icon="i-lucide-trophy"
                class="rounded-full"
                :loading="arenaVoting"
                :disabled="arenaVoting"
                @click="submitArenaVote(currentPair.right.id)"
              >
                Pick B
              </UButton>
            </div>
            <div class="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-elevated">
              <img
                :src="currentPair.right.mediaUrl || ''"
                :alt="currentPair.right.prompt"
                class="size-full object-cover"
              />
            </div>
            <p class="line-clamp-2 text-xs text-muted">{{ currentPair.right.prompt }}</p>
            <p class="text-xs text-dimmed">
              Score: {{ formatComparisonScore(currentPair.right.comparisonScore) }} ({{
                currentPair.right.comparisonWins
              }}W / {{ currentPair.right.comparisonLosses }}L)
            </p>
          </div>
        </div>

        <!-- Arena Shortcuts Bar -->
        <div
          v-if="currentPair && !arenaComplete"
          class="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-center gap-4 text-xs text-muted">
            <span class="font-medium">Shortcuts:</span>
            <span class="flex items-center gap-1"><UKbd>A</UKbd> Pick left</span>
            <span class="flex items-center gap-1"><UKbd>B</UKbd> Pick right</span>
            <span class="flex items-center gap-1"><UKbd>S</UKbd> Skip</span>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-skip-forward"
            class="rounded-full"
            @click="skipPair"
          >
            Skip Pair
          </UButton>
        </div>
      </template>

      <!-- ═══════════════ Manual Compare Mode ═══════════════ -->
      <template v-else>
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
            <p class="mt-1 text-xs text-muted">
              Choose another challenger to keep ranking Image A.
            </p>
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
      </template>
    </div>

    <!-- Manual Compare Picker Modal -->
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

    <!-- Arena Batch Picker Modal -->
    <UModal v-model:open="showBatchPicker">
      <template #content>
        <div class="flex flex-col gap-6 p-6">
          <div>
            <h2 class="font-display text-xl font-semibold">Start Arena</h2>
            <p class="mt-1 text-sm text-muted">Generate a new batch or choose an existing one.</p>
          </div>

          <!-- Generate New Batch -->
          <div class="glass-card flex flex-col gap-4 border-primary/20 bg-primary/5 p-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
              <span class="text-sm font-semibold text-default">Generate New Batch</span>
            </div>
            <p class="text-xs text-muted">
              Creates person variations with the same pose and framing, then auto-starts arena.
            </p>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-medium text-muted">Base Prompt:</span>
              <UTextarea
                v-model="batchPrompt"
                :rows="2"
                placeholder="Describe the pose, framing, and subject..."
                :disabled="generating"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-medium text-muted">Count:</span>
              <UInput
                v-model.number="batchCount"
                type="number"
                :min="2"
                :max="100"
                class="w-20"
                size="sm"
                :disabled="generating"
              />
            </div>
            <UButton
              color="primary"
              icon="i-lucide-zap"
              class="rounded-full"
              block
              :loading="generating"
              :disabled="generating || !batchPrompt.trim()"
              @click="startBatchGeneration"
            >
              {{ generating ? generatingStatus : `Generate ${batchCount} Images & Start Arena` }}
            </UButton>
          </div>

          <USeparator label="Or use existing" />

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-images"
            class="rounded-full"
            block
            :disabled="generating"
            @click="startAllArena"
          >
            All Images (latest 100)
          </UButton>

          <div v-if="loadingBatches" class="flex items-center justify-center py-4">
            <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
          </div>

          <div v-else-if="batches.length > 0" class="flex flex-col gap-2">
            <div
              v-for="batch in batches"
              :key="batch.batchId"
              class="glass-card flex cursor-pointer items-center gap-4 p-3 transition-all duration-150 hover:border-primary/30 hover:bg-primary/5"
              @click="selectBatch(batch.batchId)"
            >
              <div
                v-if="batch.previewUrl"
                class="size-12 shrink-0 overflow-hidden rounded-lg bg-elevated"
              >
                <img :src="batch.previewUrl" alt="Batch preview" class="size-full object-cover" />
              </div>
              <div
                v-else
                class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-elevated"
              >
                <UIcon name="i-lucide-image" class="size-5 text-muted" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-default">
                  {{ batch.label || `Batch ${batch.batchId.slice(0, 8)}` }}
                </p>
                <p class="text-xs text-muted">
                  {{ batch.count }} images · {{ batch.dimension }} variations
                </p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
