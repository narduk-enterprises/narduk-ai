<script setup lang="ts">
import type { ChatMessage, IterationRun, IterationStep } from '~/types/chat'
import type { Generation } from '~/types/generation'

const props = defineProps<{
  messages: ChatMessage[]
  isChatting: boolean
  generatingInline?: boolean
  iterationPassCount?: number
  headshotUrl?: string | null
  showBuilderState?: boolean
}>()

const emit = defineEmits<{
  'use-prompt': [text: string]
  'save-prompt': [text: string]
  'generate-inline': [prompt: string]
  'share-image': [imageUrl: string]
  'continue-iteration': [run: IterationRun]
}>()

const galleryViewer = useGalleryViewer()

type BuilderState = Record<string, string | null>

interface VisibleMessage {
  message: ChatMessage
  inlineImagePrompt: string | null
  inlineImageUrl: string | null
  promptText: string | null
  continuationSummary: string | null
  iterationRun: IterationRun | null
  iterationImageSteps: IterationStep[]
  iterationSavePromptText: string
  canContinueIteration: boolean
  builderState: BuilderState | null
  hasAssistantBubbleContent: boolean
  hasUserTextContent: boolean
}

const visibleMessages = computed<VisibleMessage[]>(() =>
  props.messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const promptText = message.parsedResponse?.isInlineGeneration
        ? null
        : (message.parsedResponse?.prompt ?? null)
      const inlineImageUrl = message.parsedResponse?.isInlineGeneration
        ? (message.parsedResponse.imageUrl ?? null)
        : null
      const run = message.parsedResponse?.iterationRun ?? null

      return {
        message,
        inlineImagePrompt: message.parsedResponse?.prompt ?? null,
        inlineImageUrl,
        promptText,
        continuationSummary: message.parsedResponse?.continuation_summary ?? null,
        iterationRun: run,
        iterationImageSteps: run?.steps.filter((s) => s.imageUrl) ?? [],
        iterationSavePromptText: run?.currentPrompt || run?.initialPrompt || '',
        canContinueIteration: ['completed', 'stopped', 'failed'].includes(run?.status ?? ''),
        builderState: resolveBuilderState(message, promptText),
        hasAssistantBubbleContent: hasAssistantBubbleContent(message),
        hasUserTextContent: hasUserTextContent(message),
      }
    }),
)

function openInViewer(imageUrl: string, prompt = '', generationId?: string | null) {
  const synth: Generation = {
    id: generationId || imageUrl,
    userId: '',
    type: 'image',
    mode: 't2i',
    prompt,
    sourceGenerationId: null,
    status: 'done',
    xaiRequestId: null,
    r2Key: null,
    mediaUrl: imageUrl,
    thumbnailUrl: imageUrl,
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
  galleryViewer.open([synth], 0)
}

function handleUsePrompt(prompt: string) {
  emit('use-prompt', prompt)
}

function handleSavePrompt(prompt: string) {
  emit('save-prompt', prompt)
}

function handleGenerateInline(prompt: string) {
  emit('generate-inline', prompt)
}

function handleShareImage(imageUrl: string) {
  emit('share-image', imageUrl)
}

function handleContinueIteration(run: IterationRun) {
  emit('continue-iteration', run)
}

function formatKey(key: string | number) {
  return String(key).replaceAll('_', ' ')
}

function hasUserTextContent(msg: ChatMessage) {
  return typeof msg.content === 'string' && msg.content.trim().length > 0
}

function hasAssistantBubbleContent(msg: ChatMessage) {
  return Boolean(
    msg.parsedResponse?.message ||
    (!msg.parsedResponse && msg.content) ||
    (msg.role === 'assistant' && msg.content),
  )
}

function resolveBuilderState(msg: ChatMessage, promptText: string | null) {
  const builderState = msg.parsedResponse?.builder_state
  if (!props.showBuilderState || !builderState || Object.keys(builderState).length === 0) {
    return null
  }

  return promptText ? null : builderState
}

/** Get displayable text from a message (strips XML tags from assistant replies) */
function getDisplayContent(msg: ChatMessage): string {
  if (msg.parsedResponse?.message) return msg.parsedResponse.message
  const raw = typeof msg.content === 'string' ? msg.content : ''
  return raw.replaceAll(/<[^>]+>/g, '')
}

function openInlineViewer(msg: ChatMessage) {
  const url = msg.parsedResponse?.imageUrl
  const prompt = msg.parsedResponse?.prompt ?? ''
  if (url) openInViewer(url, prompt)
}

function handleViewerKeydown(event: KeyboardEvent, openViewer: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  openViewer()
}

function handleSharedImageKeydown(event: KeyboardEvent, imageUrl: string) {
  handleViewerKeydown(event, () => openInViewer(imageUrl))
}

function handleInlineImageKeydown(event: KeyboardEvent, msg: ChatMessage) {
  handleViewerKeydown(event, () => openInlineViewer(msg))
}

function openIterationStepViewer(step: IterationStep) {
  if (!step.imageUrl) return

  openInViewer(step.imageUrl, step.renderedPrompt || step.prompt, step.generationId)
}

function handleIterationImageKeydown(event: KeyboardEvent, step: IterationStep) {
  handleViewerKeydown(event, () => openIterationStepViewer(step))
}

function getIterationStatusTone(status: IterationRun['status']) {
  if (status === 'completed') return 'success'
  if (status === 'stopped') return 'warning'
  if (status === 'failed') return 'error'
  return 'primary'
}

function getIterationStatusLabel(run: IterationRun) {
  if (run.status === 'completed') return 'Completed'
  if (run.status === 'stopped') return 'Stopped'
  if (run.status === 'failed') return 'Failed'
  return `Running ${run.completedIterations}/${run.totalIterations}`
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="(entry, index) in visibleMessages"
      :key="index"
      class="flex flex-col max-w-[90%] md:max-w-[80%]"
      :class="entry.message.role === 'user' ? 'self-end items-end' : 'self-start items-start'"
    >
      <!-- User message: handle multimodal content (text + image) -->
      <template v-if="entry.message.role === 'user'">
        <!-- Text portion -->
        <div
          v-if="entry.hasUserTextContent"
          class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-primary text-white rounded-tr-sm whitespace-pre-wrap"
        >
          {{ entry.message.content }}
        </div>
        <!-- Multimodal: text part -->
        <template v-else-if="Array.isArray(entry.message.content)">
          <div v-for="(part, pi) in entry.message.content" :key="pi">
            <div
              v-if="part.type === 'text'"
              class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-primary text-white rounded-tr-sm whitespace-pre-wrap mb-2"
            >
              {{ part.text }}
            </div>
            <div
              v-else-if="part.type === 'image_url'"
              class="mt-1 rounded-xl overflow-hidden ring-2 ring-primary/30 max-w-xs cursor-zoom-in"
              role="button"
              tabindex="0"
              @click="openInViewer(part.image_url.url)"
              @keydown="handleSharedImageKeydown($event, part.image_url.url)"
            >
              <img
                :src="part.image_url.url"
                alt="Shared image"
                class="w-full h-auto object-cover"
              />
            </div>
          </div>
        </template>
      </template>

      <!-- Assistant Chat Bubble -->
      <template v-else-if="entry.hasAssistantBubbleContent">
        <div class="flex items-center gap-1.5 mb-1">
          <div class="flex items-center justify-center size-5 rounded-full bg-primary/15">
            <UIcon name="i-lucide-bot" class="size-3 text-primary" />
          </div>
          <span class="text-[11px] font-medium text-muted">Grok</span>
        </div>
        <div
          class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-elevated text-default border border-default rounded-tl-sm shadow-sm"
        >
          <MarkdownRenderer :content="getDisplayContent(entry.message)" />
        </div>
      </template>

      <!-- Inline Generated Image -->
      <div v-if="entry.inlineImageUrl" class="mt-3 animate-fade-in-up">
        <div class="flex items-end gap-3">
          <!-- Thumbnail — click to open in gallery viewer -->
          <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events vuejs-accessibility/no-static-element-interactions -- image thumbnail acting as interactive button -->
          <div
            class="shrink-0 rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.02] shadow-card cursor-zoom-in"
            role="button"
            tabindex="0"
            @click="openInlineViewer(entry.message)"
            @keydown="handleInlineImageKeydown($event, entry.message)"
          >
            <img
              :src="entry.inlineImageUrl"
              :alt="entry.inlineImagePrompt || 'Generated image'"
              class="h-40 w-auto max-w-[180px] object-cover pointer-events-none"
            />
          </div>

          <!-- Action buttons stacked vertically beside the image -->
          <div class="flex flex-col gap-1.5">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-share-2"
              size="xs"
              @click="handleShareImage(entry.inlineImageUrl)"
            >
              Share with Agent
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-images"
              size="xs"
              @click="openInlineViewer(entry.message)"
            >
              Open Viewer
            </UButton>
          </div>
        </div>
      </div>

      <!-- Generated Prompt Card -->
      <div v-if="entry.promptText" class="mt-3 w-full animate-fade-in-up">
        <UCard class="ring-1 ring-primary/20 bg-primary/5">
          <div class="p-4 sm:p-5 flex items-start gap-3">
            <UIcon name="i-lucide-sparkles" class="size-5 text-primary shrink-0 mt-0.5" />
            <div class="flex-1 space-y-3">
              <p class="text-sm font-medium text-default leading-relaxed font-mono select-all">
                {{ entry.promptText }}
              </p>
              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/10">
                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-wand-2"
                  size="sm"
                  @click="handleUsePrompt(entry.promptText)"
                >
                  Use This Prompt
                </UButton>
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-lucide-image"
                  size="sm"
                  @click="handleGenerateInline(entry.promptText)"
                >
                  Generate Here
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-bookmark-plus"
                  size="sm"
                  @click="handleSavePrompt(entry.promptText)"
                >
                  Save to Presets
                </UButton>
                <CopyButton :text="entry.promptText" />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="entry.continuationSummary" class="mt-3 w-full animate-fade-in-up">
        <UCard class="ring-1 ring-info/20 bg-info/5">
          <div class="p-4 sm:p-5 flex items-start gap-3">
            <UIcon name="i-lucide-scroll-text" class="size-5 text-info shrink-0 mt-0.5" />
            <div class="flex-1 space-y-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-info">
                  Continuation Summary
                </p>
                <p class="mt-2 text-sm text-default leading-relaxed whitespace-pre-wrap">
                  {{ entry.continuationSummary }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-info/10">
                <CopyButton :text="entry.continuationSummary" />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="entry.iterationRun" class="mt-3 w-full animate-fade-in-up">
        <UCard class="ring-1 ring-primary/20 overflow-hidden">
          <!-- Header -->
          <div class="px-4 pt-4 sm:px-5 sm:pt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center justify-center size-8 rounded-full bg-primary/10">
                <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
              </div>
              <div>
                <p class="font-display font-semibold text-sm text-default">Refinement Progress</p>
                <p class="text-xs text-muted">
                  {{ getIterationStatusLabel(entry.iterationRun) }}
                </p>
              </div>
            </div>
            <UBadge
              :color="getIterationStatusTone(entry.iterationRun.status)"
              variant="subtle"
              size="sm"
            >
              {{ entry.iterationRun.completedIterations }}/{{ entry.iterationRun.totalIterations }}
              rounds
            </UBadge>
          </div>

          <!-- Goal pill -->
          <div class="px-4 pt-3 sm:px-5">
            <div
              class="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2"
            >
              <UIcon name="i-lucide-target" class="size-4 text-primary shrink-0 mt-0.5" />
              <p class="text-sm text-default leading-relaxed">{{ entry.iterationRun.goal }}</p>
            </div>
          </div>

          <!-- Context pill (only if present) -->
          <div v-if="entry.iterationRun.context" class="px-4 pt-2 sm:px-5">
            <div
              class="flex items-start gap-2 rounded-lg bg-elevated border border-default/50 px-3 py-2"
            >
              <UIcon name="i-lucide-message-circle" class="size-4 text-muted shrink-0 mt-0.5" />
              <p class="text-sm text-muted leading-relaxed">{{ entry.iterationRun.context }}</p>
            </div>
          </div>

          <!-- Image comparison strip (when multiple passes have images) -->
          <div v-if="entry.iterationImageSteps.length > 1" class="px-4 pt-4 sm:px-5">
            <p class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">
              Visual Progression
            </p>
            <div class="image-strip">
              <div
                v-for="(step, si) in entry.iterationImageSteps"
                :key="`strip-${si}`"
                class="relative rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.02] shadow-card cursor-zoom-in"
                role="button"
                tabindex="0"
                @click="openIterationStepViewer(step)"
                @keydown="handleIterationImageKeydown($event, step)"
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
                v-for="step in entry.iterationRun.steps"
                :key="`${entry.iterationRun.round}-${step.iteration}`"
                class="iteration-step"
              >
                <!-- Step dot -->
                <div class="iteration-step-dot iteration-step-dot--done">
                  <UIcon name="i-lucide-check" class="size-3" />
                </div>

                <!-- Step content -->
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-primary">
                      Round {{ step.iteration }}
                    </span>
                  </div>

                  <!-- Change summary -->
                  <p class="text-sm text-default leading-relaxed">
                    {{ step.changeSummary }}
                  </p>

                  <!-- Image + details row -->
                  <div
                    v-if="step.imageUrl || step.renderedPrompt || step.imageAnalysis"
                    class="flex flex-col gap-3 md:flex-row md:items-start"
                  >
                    <!-- Single image (only shown when strip isn't visible) -->
                    <div
                      v-if="step.imageUrl && entry.iterationImageSteps.length <= 1"
                      class="w-fit rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.01] shadow-card cursor-zoom-in"
                      role="button"
                      tabindex="0"
                      @click="openIterationStepViewer(step)"
                      @keydown="handleIterationImageKeydown($event, step)"
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
                          <span
                            class="text-[11px] font-semibold text-muted uppercase tracking-wider"
                            >AI Feedback</span
                          >
                        </div>
                        <p class="text-xs text-default/90 leading-relaxed">
                          {{ step.imageAnalysis }}
                        </p>
                      </div>

                      <!-- Prompt used (collapsed by default feel) -->
                      <div
                        v-if="step.renderedPrompt"
                        class="rounded-lg bg-elevated/50 border border-default/30 px-3 py-2"
                      >
                        <div class="flex items-center gap-1.5 mb-1">
                          <UIcon name="i-lucide-file-text" class="size-3.5 text-dimmed" />
                          <span
                            class="text-[11px] font-semibold text-dimmed uppercase tracking-wider"
                            >Prompt Used</span
                          >
                        </div>
                        <p class="text-xs text-muted leading-relaxed font-mono wrap-break-word">
                          {{ step.renderedPrompt }}
                        </p>
                      </div>

                      <div v-if="step.generationId" class="pt-0.5">
                        <UButton
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          icon="i-lucide-images"
                          :to="`/gallery/${step.generationId}`"
                        >
                          Open in Gallery
                        </UButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Running indicator as timeline step -->
              <div v-if="entry.iterationRun.status === 'running'" class="iteration-step">
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
                      {{ (entry.iterationRun.completedIterations || 0) + 1 }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Failed indicator as timeline step -->
              <div v-if="entry.iterationRun.status === 'failed'" class="iteration-step">
                <div
                  class="iteration-step-dot"
                  style="background: var(--ui-color-error); color: white"
                >
                  <UIcon name="i-lucide-x" class="size-3" />
                </div>
                <div
                  class="rounded-xl border border-dashed border-error/30 bg-error/5 px-4 py-3 flex items-center gap-3"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium text-error">Failed</span>
                    <span class="text-xs text-muted">
                      Something went wrong on round
                      {{ (entry.iterationRun.completedIterations || 0) + 1 }}. You can retry or
                      continue from the last successful point.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Continue footer -->
          <div
            v-if="entry.canContinueIteration"
            class="px-4 py-3 sm:px-5 border-t border-default/50 bg-elevated/50 flex flex-wrap items-center justify-between gap-3"
          >
            <p class="text-xs text-muted">
              <template v-if="entry.iterationRun.status === 'failed'">
                Retry from the last successful prompt.
              </template>
              <template v-else>
                Keep refining for
                {{ props.iterationPassCount ?? entry.iterationRun.totalIterations }}
                more
                {{
                  (props.iterationPassCount ?? entry.iterationRun.totalIterations) === 1
                    ? 'round'
                    : 'rounds'
                }}?
              </template>
            </p>
            <div class="flex items-center gap-2">
              <UButton
                color="primary"
                :variant="entry.iterationRun.status === 'failed' ? 'solid' : 'soft'"
                :icon="
                  entry.iterationRun.status === 'failed'
                    ? 'i-lucide-refresh-cw'
                    : 'i-lucide-rotate-cw'
                "
                size="sm"
                @click="handleContinueIteration(entry.iterationRun)"
              >
                {{ entry.iterationRun.status === 'failed' ? 'Retry' : 'Continue' }}
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-bookmark-plus"
                size="sm"
                @click="handleSavePrompt(entry.iterationSavePromptText)"
              >
                Save as Preset
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Inline Builder State Card (only when showBuilderState is true) -->
      <div v-if="entry.builderState" class="mt-3 w-full animate-fade-in-up">
        <UCard class="ring-1 ring-primary/20 bg-primary/5">
          <div class="p-3 sm:p-4">
            <div class="flex items-center gap-2 mb-2">
              <img
                v-if="headshotUrl"
                :src="headshotUrl"
                alt="Headshot"
                class="size-7 rounded-full object-cover ring-1 ring-primary/30 shrink-0"
              />
              <UIcon v-else name="i-lucide-hammer" class="size-4 text-primary" />
              <span class="text-xs font-semibold text-primary">Attributes Updated</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1">
              <div
                v-for="(val, key) in entry.builderState"
                :key="key"
                class="text-[10px] px-1.5 py-0.5 rounded"
                :class="val ? 'bg-elevated text-default' : 'text-dimmed'"
              >
                <span class="capitalize font-medium">{{ formatKey(key) }}:</span>
                {{ val || '—' }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Typing Indicator -->
    <div v-if="isChatting" class="flex self-start items-start gap-3 max-w-[85%] animate-fade-in-up">
      <div class="flex items-center justify-center size-5 rounded-full bg-primary/15 mt-4 shrink-0">
        <UIcon name="i-lucide-bot" class="size-3 text-primary" />
      </div>
      <div class="space-y-1">
        <span class="text-[11px] font-medium text-muted">Grok is thinking…</span>
        <div
          class="flex items-center gap-1.5 p-3 rounded-2xl bg-elevated border border-default rounded-tl-sm"
        >
          <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span class="size-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>

    <!-- Inline Generation Loading -->
    <div
      v-if="generatingInline"
      class="flex self-start items-center gap-3 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%] animate-fade-in-up"
    >
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-primary" />
      <span class="text-sm text-muted">Generating image…</span>
    </div>
  </div>
</template>
