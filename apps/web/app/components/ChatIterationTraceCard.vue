<script setup lang="ts">
import type { IterationRun, IterationStep } from '~/types/chat'

defineProps<{
  run: IterationRun
  imageSteps: IterationStep[]
  savePromptText: string
  canContinue: boolean
  iterationPassCount?: number
}>()

const emit = defineEmits<{
  continue: [run: IterationRun]
  'save-prompt': [text: string]
  'open-image': [url: string, prompt: string, generationId?: string | null]
}>()

function statusTone(status: IterationRun['status']) {
  if (status === 'completed') return 'success'
  if (status === 'stopped') return 'warning'
  if (status === 'failed') return 'error'
  return 'primary'
}

function statusLabel(run: IterationRun) {
  if (run.status === 'completed') return 'Completed'
  if (run.status === 'stopped') return 'Stopped'
  if (run.status === 'failed') return 'Failed'
  return `Running ${run.completedIterations}/${run.totalIterations}`
}

function openStepViewer(step: IterationStep) {
  if (!step.imageUrl) return
  emit('open-image', step.imageUrl, step.renderedPrompt || step.prompt, step.generationId)
}

function handleImageKeydown(event: KeyboardEvent, step: IterationStep) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openStepViewer(step)
}

const PROMPT_COLLAPSE_THRESHOLD = 120
const expandedPrompts = ref(new Set<number>())

function isPromptExpanded(iteration: number) {
  return expandedPrompts.value.has(iteration)
}

function togglePrompt(iteration: number) {
  const next = new Set(expandedPrompts.value)
  if (next.has(iteration)) next.delete(iteration)
  else next.add(iteration)
  expandedPrompts.value = next
}
</script>

<template>
  <UCard class="ring-1 ring-primary/20 overflow-hidden">
    <!-- Header -->
    <div class="px-4 pt-4 sm:px-5 sm:pt-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="flex items-center justify-center size-8 rounded-full bg-primary/10">
          <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
        </div>
        <div>
          <p class="font-display font-semibold text-sm text-default">Refinement Progress</p>
          <p class="text-xs text-muted">{{ statusLabel(run) }}</p>
        </div>
      </div>
      <UBadge :color="statusTone(run.status)" variant="subtle" size="sm">
        {{ run.completedIterations }}/{{ run.totalIterations }} rounds
      </UBadge>
    </div>

    <!-- Goal pill -->
    <div class="px-4 pt-3 sm:px-5">
      <div
        class="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2"
      >
        <UIcon name="i-lucide-target" class="size-4 text-primary shrink-0 mt-0.5" />
        <p class="text-sm text-default leading-relaxed">{{ run.goal }}</p>
      </div>
    </div>

    <!-- Context pill -->
    <div v-if="run.context" class="px-4 pt-2 sm:px-5">
      <div class="flex items-start gap-2 rounded-lg bg-elevated border border-default/50 px-3 py-2">
        <UIcon name="i-lucide-message-circle" class="size-4 text-muted shrink-0 mt-0.5" />
        <p class="text-sm text-muted leading-relaxed">{{ run.context }}</p>
      </div>
    </div>

    <!-- Image comparison strip -->
    <div v-if="imageSteps.length > 1" class="px-4 pt-4 sm:px-5">
      <p class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">
        Visual Progression
      </p>
      <div class="image-strip">
        <div
          v-for="(step, si) in imageSteps"
          :key="`strip-${si}`"
          class="relative rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.02] shadow-card cursor-zoom-in"
          role="button"
          tabindex="0"
          @click="openStepViewer(step)"
          @keydown="handleImageKeydown($event, step)"
        >
          <img
            :src="step.imageUrl!"
            :alt="`Round ${step.iteration}`"
            class="h-24 w-auto min-w-20 object-cover"
          />
          <span
            class="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/60 rounded-full px-1.5 py-0.5"
          >
            {{ step.iteration }}
          </span>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <div class="iteration-timeline space-y-4">
        <div
          v-for="step in run.steps"
          :key="`${run.round}-${step.iteration}`"
          class="iteration-step"
        >
          <div class="iteration-step-dot iteration-step-dot--done">
            <UIcon name="i-lucide-check" class="size-3" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-primary">Round {{ step.iteration }}</span>
            </div>

            <p class="text-sm text-default leading-relaxed">{{ step.changeSummary }}</p>

            <div
              v-if="step.imageUrl || step.renderedPrompt || step.imageAnalysis"
              class="flex flex-col gap-3 md:flex-row md:items-start"
            >
              <!-- Single image (only when strip isn't visible) -->
              <div
                v-if="step.imageUrl && imageSteps.length <= 1"
                class="w-fit rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.01] shadow-card cursor-zoom-in"
                role="button"
                tabindex="0"
                @click="openStepViewer(step)"
                @keydown="handleImageKeydown($event, step)"
              >
                <img
                  :src="step.imageUrl"
                  :alt="step.renderedPrompt || `Round ${step.iteration}`"
                  class="h-36 w-auto max-w-[180px] object-cover"
                />
              </div>

              <div class="min-w-0 flex-1 space-y-2">
                <!-- AI Feedback -->
                <div
                  v-if="step.imageAnalysis"
                  class="rounded-lg bg-elevated border border-default/50 px-3 py-2"
                >
                  <div class="flex items-center gap-1.5 mb-1">
                    <UIcon name="i-lucide-scan-eye" class="size-3.5 text-muted" />
                    <span class="text-[11px] font-semibold text-muted uppercase tracking-wider">
                      AI Feedback
                    </span>
                  </div>
                  <p class="text-xs text-default/90 leading-relaxed">{{ step.imageAnalysis }}</p>
                </div>

                <!-- Prompt used (auto-collapsed for long prompts) -->
                <div
                  v-if="step.renderedPrompt"
                  class="rounded-lg bg-elevated/50 border border-default/30 px-3 py-2"
                >
                  <div
                    class="flex items-center gap-1.5 cursor-pointer"
                    role="button"
                    tabindex="0"
                    @click="togglePrompt(step.iteration)"
                    @keydown.enter="togglePrompt(step.iteration)"
                  >
                    <UIcon
                      :name="
                        isPromptExpanded(step.iteration)
                          ? 'i-lucide-chevron-down'
                          : 'i-lucide-chevron-right'
                      "
                      class="size-3 text-dimmed transition-transform"
                    />
                    <UIcon name="i-lucide-file-text" class="size-3.5 text-dimmed" />
                    <span class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">
                      Prompt Used
                    </span>
                  </div>
                  <p
                    v-if="
                      step.renderedPrompt.length <= PROMPT_COLLAPSE_THRESHOLD ||
                      isPromptExpanded(step.iteration)
                    "
                    class="text-xs text-muted leading-relaxed font-mono wrap-break-word mt-1.5"
                  >
                    {{ step.renderedPrompt }}
                  </p>
                  <p
                    v-else
                    class="text-xs text-muted leading-relaxed font-mono wrap-break-word mt-1.5"
                  >
                    {{ step.renderedPrompt.slice(0, PROMPT_COLLAPSE_THRESHOLD) }}…
                  </p>
                </div>

                <div v-if="step.imageUrl" class="pt-0.5">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-maximize-2"
                    @click="openStepViewer(step)"
                  >
                    View Full Size
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Running indicator -->
        <div v-if="run.status === 'running'" class="iteration-step">
          <div class="iteration-step-dot iteration-step-dot--active">
            <UIcon name="i-lucide-loader-2" class="size-3 animate-spin" />
          </div>
          <div
            class="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-primary">Working on it…</span>
              <span class="text-xs text-muted">
                Analyzing your image and refining the prompt for round
                {{ (run.completedIterations || 0) + 1 }}
              </span>
            </div>
          </div>
        </div>

        <!-- Failed indicator -->
        <div v-if="run.status === 'failed'" class="iteration-step">
          <div class="iteration-step-dot" style="background: var(--ui-color-error); color: white">
            <UIcon name="i-lucide-x" class="size-3" />
          </div>
          <div
            class="rounded-xl border border-dashed border-error/30 bg-error/5 px-4 py-3 flex items-center gap-3"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-error">Failed</span>
              <span class="text-xs text-muted">
                Something went wrong on round {{ (run.completedIterations || 0) + 1 }}. You can
                retry or continue from the last successful point.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Continue footer -->
    <div
      v-if="canContinue"
      class="px-4 py-3 sm:px-5 border-t border-default/50 bg-elevated/50 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="text-xs text-muted">
        <template v-if="run.status === 'failed'"> Retry from the last successful prompt. </template>
        <template v-else>
          Keep refining for
          {{ iterationPassCount ?? run.totalIterations }}
          more
          {{ (iterationPassCount ?? run.totalIterations) === 1 ? 'round' : 'rounds' }}?
        </template>
      </p>
      <div class="flex items-center gap-2">
        <UButton
          color="primary"
          :variant="run.status === 'failed' ? 'solid' : 'soft'"
          :icon="run.status === 'failed' ? 'i-lucide-refresh-cw' : 'i-lucide-rotate-cw'"
          size="sm"
          @click="emit('continue', run)"
        >
          {{ run.status === 'failed' ? 'Retry' : 'Continue' }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-bookmark-plus"
          size="sm"
          @click="emit('save-prompt', savePromptText)"
        >
          Save as Preset
        </UButton>
      </div>
    </div>
  </UCard>
</template>
