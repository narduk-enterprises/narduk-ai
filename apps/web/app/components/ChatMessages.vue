<script setup lang="ts">
import type { ChatMessage, IterationRun, IterationStep } from '~/types/chat'
import type { Generation } from '~/types/generation'

const props = defineProps<{
  messages: ChatMessage[]
  isChatting: boolean
  generatingInline?: boolean
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

      return {
        message,
        inlineImagePrompt: message.parsedResponse?.prompt ?? null,
        inlineImageUrl,
        promptText,
        continuationSummary: message.parsedResponse?.continuation_summary ?? null,
        iterationRun: message.parsedResponse?.iterationRun ?? null,
        canContinueIteration: ['completed', 'stopped'].includes(
          message.parsedResponse?.iterationRun?.status ?? '',
        ),
        builderState: resolveBuilderState(message, promptText),
        hasAssistantBubbleContent: hasAssistantBubbleContent(message),
        hasUserTextContent: hasUserTextContent(message),
      }
    }),
)

function openInViewer(imageUrl: string, prompt = '') {
  const synth: Generation = {
    id: imageUrl,
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

  openInViewer(step.imageUrl, step.renderedPrompt || step.prompt)
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
      <div
        v-else-if="entry.hasAssistantBubbleContent"
        class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-elevated text-default border border-default rounded-tl-sm shadow-sm"
      >
        <MarkdownRenderer :content="getDisplayContent(entry.message)" />
      </div>

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
        <UCard class="ring-1 ring-primary/20 bg-primary/5">
          <div class="p-4 sm:p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Iteration Trace
                </p>
                <p class="text-sm text-muted">
                  Round {{ entry.iterationRun.round }} ·
                  {{ getIterationStatusLabel(entry.iterationRun) }}
                </p>
              </div>
              <UBadge
                :color="getIterationStatusTone(entry.iterationRun.status)"
                variant="subtle"
                size="sm"
              >
                {{ entry.iterationRun.completedIterations }}/{{
                  entry.iterationRun.totalIterations
                }}
              </UBadge>
            </div>

            <div class="rounded-xl border border-default/50 bg-default/60 px-3 py-2">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-dimmed">Goal</p>
              <p class="mt-1 text-sm text-default whitespace-pre-wrap">
                {{ entry.iterationRun.goal }}
              </p>
            </div>

            <div class="space-y-2">
              <div
                v-for="step in entry.iterationRun.steps"
                :key="`${entry.iterationRun.round}-${step.iteration}`"
                class="rounded-xl border border-default/50 bg-default/60 px-3 py-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Pass {{ step.iteration }}
                  </p>
                  <span class="text-[11px] text-dimmed">
                    Prompt {{ step.prompt.length }} chars
                  </span>
                </div>
                <p class="mt-1 text-sm text-default whitespace-pre-wrap">
                  {{ step.changeSummary }}
                </p>
                <div v-if="step.imageUrl || step.renderedPrompt || step.imageAnalysis" class="mt-3">
                  <div class="flex flex-col gap-3 md:flex-row md:items-start">
                    <div
                      v-if="step.imageUrl"
                      class="w-fit rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.01] shadow-card cursor-zoom-in"
                      role="button"
                      tabindex="0"
                      @click="openIterationStepViewer(step)"
                      @keydown="handleIterationImageKeydown($event, step)"
                    >
                      <img
                        :src="step.imageUrl"
                        :alt="step.renderedPrompt || `Iteration pass ${step.iteration}`"
                        class="h-36 w-auto max-w-[180px] object-cover"
                      />
                    </div>

                    <div class="min-w-0 flex-1 space-y-3">
                      <div v-if="step.renderedPrompt" class="space-y-1">
                        <p
                          class="text-[11px] font-semibold uppercase tracking-[0.16em] text-dimmed"
                        >
                          Render Prompt
                        </p>
                        <p
                          class="text-xs text-default/90 leading-relaxed font-mono whitespace-pre-wrap break-words"
                        >
                          {{ step.renderedPrompt }}
                        </p>
                      </div>

                      <div v-if="step.imageAnalysis" class="space-y-1">
                        <p
                          class="text-[11px] font-semibold uppercase tracking-[0.16em] text-dimmed"
                        >
                          Image Review
                        </p>
                        <p class="text-xs text-default/90 leading-relaxed whitespace-pre-wrap">
                          {{ step.imageAnalysis }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="entry.iterationRun.status === 'running'"
                class="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-sm text-muted"
              >
                Working on the next pass...
              </div>
            </div>

            <div
              v-if="entry.canContinueIteration"
              class="flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 pt-3"
            >
              <p class="text-xs text-muted">
                Continue from the latest prompt if you want another refinement round.
              </p>
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-rotate-cw"
                size="sm"
                @click="handleContinueIteration(entry.iterationRun)"
              >
                Continue x5
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
    <div
      v-if="isChatting"
      class="flex self-start items-center gap-1.5 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%]"
    >
      <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
      <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
      <span class="size-2 rounded-full bg-primary animate-bounce"></span>
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
