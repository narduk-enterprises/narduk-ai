<script setup lang="ts">
import type { ChatMessage, IterationRun, IterationStep } from '~/types/chat'
import { createSyntheticGeneration } from '~/utils/presetMetadata'

const props = defineProps<{
  messages: ChatMessage[]
  isChatting: boolean
  generatingInline?: boolean
  iterationPassCount?: number
  headshotUrl?: string | null
  showBuilderState?: boolean
  savingPrompt?: boolean
}>()

const emit = defineEmits<{
  'use-prompt': [text: string]
  'save-prompt': [text: string]
  'generate-inline': [prompt: string]
  'share-image': [imageUrl: string]
  'continue-iteration': [run: IterationRun]
  'quick-start': [text: string]
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
  galleryViewer.open([createSyntheticGeneration(imageUrl, prompt, generationId)], 0)
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

// Track recently-saved prompts for visual feedback
const recentlySaved = ref(new Set<string>())

function handleSaveAndTrack(promptText: string) {
  handleSavePrompt(promptText)
  // Mark as saved for visual feedback — clear after 3s
  const key = promptText.slice(0, 50)
  recentlySaved.value = new Set([...recentlySaved.value, key])
  setTimeout(() => {
    const next = new Set(recentlySaved.value)
    next.delete(key)
    recentlySaved.value = next
  }, 3000)
}

function isSaved(promptText: string) {
  return recentlySaved.value.has(promptText.slice(0, 50))
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
  // If the raw content looks like JSON, try to extract 'message' key
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>
      if (typeof obj.message === 'string') return obj.message
    } catch {
      // Not valid JSON — fall through
    }
  }
  return raw.replaceAll(/<[^>]+>/g, '')
}

/** Check if a response has raw JSON content that should be shown collapsed */
function hasRawJsonContent(msg: ChatMessage): boolean {
  if (!msg.content || typeof msg.content !== 'string') return false
  const trimmed = msg.content.trim()
  return trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length > 100
}

/** Format JSON for display */
function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content.trim()), null, 2)
  } catch {
    return content
  }
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

function handleOpenImage(url: string, prompt: string, generationId?: string | null) {
  openInViewer(url, prompt, generationId)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Empty State -->
    <div
      v-if="visibleMessages.length === 0 && !isChatting"
      class="flex flex-col items-center justify-center py-12 md:py-20 text-center"
    >
      <div class="flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
        <UIcon name="i-lucide-sparkles" class="size-7 text-primary" />
      </div>
      <h2 class="font-display font-semibold text-lg text-default mb-1">Start Brainstorming</h2>
      <p class="text-sm text-muted max-w-md leading-relaxed">
        Describe what you want to create and Grok will craft a detailed prompt.
        Switch to Iterate mode to refine with visual feedback.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-2 mt-5">
        <UButton
          variant="soft"
          color="primary"
          size="sm"
          icon="i-lucide-image"
          @click="emit('quick-start', 'Create a cinematic portrait with dramatic lighting')"
        >
          Portrait
        </UButton>
        <UButton
          variant="soft"
          color="primary"
          size="sm"
          icon="i-lucide-mountain"
          @click="emit('quick-start', 'Design a vast sci-fi landscape at golden hour')"
        >
          Landscape
        </UButton>
        <UButton
          variant="soft"
          color="primary"
          size="sm"
          icon="i-lucide-palette"
          @click="emit('quick-start', 'Create an abstract art piece with vibrant colors')"
        >
          Abstract
        </UButton>
      </div>
    </div>

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

          <!-- Collapsible raw JSON (shown when model responds with JSON) -->
          <div
            v-if="hasRawJsonContent(entry.message)"
            class="mt-3 pt-3 border-t border-default"
          >
            <UAccordion
              :items="[{ label: 'Raw Response', icon: 'i-lucide-code-2', content: formatJson(entry.message.content as string) }]"
              :default-value="[]"
            >
              <template #body="{ item }">
                <pre class="text-xs font-mono text-muted whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-muted/30 rounded-lg p-3">{{ item.content }}</pre>
              </template>
            </UAccordion>
          </div>
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
                  :icon="isSaved(entry.promptText) ? 'i-lucide-check-circle' : 'i-lucide-bookmark-plus'"
                  size="sm"
                  :loading="savingPrompt && !isSaved(entry.promptText)"
                  :disabled="isSaved(entry.promptText)"
                  @click="handleSaveAndTrack(entry.promptText)"
                >
                  {{ isSaved(entry.promptText) ? 'Saved' : 'Save to Presets' }}
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
        <ChatIterationTraceCard
          :run="entry.iterationRun"
          :image-steps="entry.iterationImageSteps"
          :save-prompt-text="entry.iterationSavePromptText"
          :can-continue="entry.canContinueIteration"
          :iteration-pass-count="props.iterationPassCount"
          @continue="handleContinueIteration"
          @save-prompt="handleSavePrompt"
          @open-image="handleOpenImage"
        />
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
