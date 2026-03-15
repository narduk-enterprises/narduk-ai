<script setup lang="ts">
import type { IterationRun } from '~/types/chat'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Brainstorm — Narduk AI',
  description: 'Brainstorm ideas for AI image and video generation with Grok.',
})
useWebPageSchema({
  name: 'Brainstorm — Narduk AI',
  description: 'Brainstorm ideas for AI image and video generation with Grok.',
})

const {
  chatMessages,
  chatInput,
  inputMode,
  iterationPrompt,
  iterationGoal,
  iterationContext,
  iterationPassCount,
  activeIterationRun,
  isChatting,
  isIterating,
  generatingInline,
  error,
  selectedModel,
  initializeChat,
  sendChatMessage,
  startIterationRun,
  stopIterationRun,
  continueIterationRun,
  setIterationPassCount,
  generateInline,
  shareImageWithAgent,
  startNewChat,
} = useChatForm({ persistence: 'session', resumeMode: 'general' })

const { createElement, fetchElements } = usePromptElements()

const savingPrompt = ref(false)
const isFormCollapsed = ref(false)
const toast = useToast()

// --- SessionStorage persistence for iteration form ---
const STORAGE_KEY = 'narduk-iteration-form'

interface IterationFormState {
  inputMode: 'chat' | 'iterate'
  prompt: string
  goal: string
  context: string
  passCount: number
}

function saveFormState() {
  if (!import.meta.client) return
  const state: IterationFormState = {
    inputMode: inputMode.value,
    prompt: iterationPrompt.value,
    goal: iterationGoal.value,
    context: iterationContext.value,
    passCount: iterationPassCount.value,
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded — ignore */
  }
}

function restoreFormState() {
  if (!import.meta.client) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const state = JSON.parse(raw) as Partial<IterationFormState>
    if (state.inputMode) inputMode.value = state.inputMode
    if (state.prompt) iterationPrompt.value = state.prompt
    if (state.goal) iterationGoal.value = state.goal
    if (state.context) iterationContext.value = state.context
    if (state.passCount) iterationPassCount.value = state.passCount
  } catch {
    /* corrupt data — ignore */
  }
}

function clearFormState() {
  if (!import.meta.client) return
  sessionStorage.removeItem(STORAGE_KEY)
}

// Persist form inputs on change
watch(
  [inputMode, iterationPrompt, iterationGoal, iterationContext, iterationPassCount],
  saveFormState,
)

// Also restore last iteration run's prompt from loaded messages
function restoreLastIterationFromMessages() {
  const msgs = chatMessages.value
  for (let i = msgs.length - 1; i >= 0; i--) {
    const run = msgs[i]?.parsedResponse?.iterationRun
    if (run) {
      iterationPrompt.value = run.currentPrompt || run.initialPrompt
      iterationGoal.value = run.goal
      if (run.context) iterationContext.value = run.context
      inputMode.value = 'iterate'
      break
    }
  }
}

const { chatScrollContainer: scrollRef, scrollToBottom } = useChatScroll({
  chatMessages,
  isChatting,
  isIterating,
  generatingInline,
  activeIterationRun,
})

onMounted(async () => {
  restoreFormState()
  fetchElements()
  try {
    await initializeChat()
    restoreLastIterationFromMessages()
  } catch (e) {
    console.error('[chat] Failed to initialize chat', e)
  }
  scrollToBottom()
})

watch(isIterating, (running) => {
  // Auto-collapse on mobile when iteration starts, auto-expand when done
  isFormCollapsed.value = running
})

function useGeneratedPrompt(promptText: string) {
  navigateTo({ path: '/generate', query: { prompt: promptText } })
}

async function savePromptToLibrary(promptText: string) {
  const lastAssistant = [...chatMessages.value].reverse().find((m) => m.role === 'assistant')
  const name = lastAssistant?.parsedResponse?.suggested_name || 'Brainstormed prompt'

  savingPrompt.value = true
  try {
    await createElement('prompt', name, promptText)
    toast.add({
      title: 'Saved to Presets',
      description: `"${name}" has been added to your presets.`,
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    await fetchElements()
  } catch {
    toast.add({
      title: 'Failed to Save',
      description: 'An error occurred while saving.',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  } finally {
    savingPrompt.value = false
  }
}

async function handleGenerateInline(prompt: string) {
  await generateInline(prompt)
}

async function handleShareImage(imageUrl: string) {
  await shareImageWithAgent(imageUrl)
}

async function handleContinueIteration(run: IterationRun) {
  await continueIterationRun(run)
}

const { chatModels, pending: modelsPending, error: modelsError } = useXaiModels()

function handleNewChat() {
  clearFormState()
  startNewChat()
}
</script>

<template>
  <div class="h-[calc(100dvh-4rem)] flex flex-col bg-default">
    <!-- Header -->
    <div
      class="h-14 border-b border-default/50 px-4 md:px-6 flex items-center justify-between shrink-0 glass z-10"
    >
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-bot" class="size-6 text-primary" />
        <h1 class="font-display font-semibold text-lg">Brainstorm</h1>
      </div>
      <div class="flex items-center gap-2">
        <!-- Model picker -->
        <ClientOnly>
          <UTooltip :text="modelsError ? 'Failed to load' : ''" :prevent="!modelsError">
            <USelectMenu
              v-model="selectedModel"
              :items="chatModels"
              :loading="modelsPending"
              :disabled="modelsPending || !!modelsError"
              size="sm"
              class="min-w-40 w-auto hidden sm:flex"
              :ui="{ base: 'rounded-lg' }"
            >
              <template #leading>
                <UIcon
                  v-if="modelsError"
                  name="i-lucide-alert-circle"
                  class="size-3.5 text-error"
                />
                <UIcon v-else name="i-lucide-cpu" class="size-3.5 text-muted" />
              </template>
            </USelectMenu>
          </UTooltip>
          <template #fallback>
            <div
              class="hidden sm:block min-w-40 h-8 rounded-lg bg-elevated border border-default"
            />
          </template>
        </ClientOnly>

        <!-- New Chat -->
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-plus"
          size="sm"
          :disabled="isIterating || chatMessages.filter((m) => m.role !== 'system').length === 0"
          @click="handleNewChat"
        >
          <span class="hidden sm:inline">New Chat</span>
        </UButton>

        <UButton to="/presets" variant="ghost" color="neutral" icon="i-lucide-bookmark" size="sm">
          <span class="hidden sm:inline">Presets</span>
        </UButton>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 md:p-6">
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-alert-triangle"
        :title="error"
        class="mb-4"
      />

      <ChatMessages
        :messages="chatMessages"
        :is-chatting="isChatting"
        :generating-inline="generatingInline"
        :iteration-pass-count="iterationPassCount"
        @use-prompt="useGeneratedPrompt"
        @save-prompt="savePromptToLibrary"
        @generate-inline="handleGenerateInline"
        @share-image="handleShareImage"
        @continue-iteration="handleContinueIteration"
      />
    </div>

    <!-- Input Area -->
    <div
      class="px-3 pt-2 md:px-6 md:pt-4 md:pb-8 bg-default border-t border-default/50 shrink-0 pb-safe"
    >
      <div class="max-w-5xl mx-auto space-y-2 md:space-y-3">
        <!-- Segmented Mode Toggle -->
        <div
          class="inline-flex items-center rounded-full bg-elevated border border-default/50 p-0.5 relative"
        >
          <div
            class="absolute h-[calc(100%-4px)] rounded-full bg-primary transition-all duration-200 ease-out"
            :style="{
              width: inputMode === 'chat' ? '50%' : '50%',
              left: inputMode === 'chat' ? '2px' : 'calc(50% + 0px)',
            }"
          />
          <UButton
            :variant="inputMode === 'chat' ? 'link' : 'link'"
            :color="inputMode === 'chat' ? 'neutral' : 'neutral'"
            size="sm"
            icon="i-lucide-message-square"
            class="rounded-full relative z-10 transition-colors duration-200 px-4"
            :class="inputMode === 'chat' ? 'text-white' : 'text-muted'"
            :disabled="isIterating"
            @click="inputMode = 'chat'"
          >
            Chat
          </UButton>
          <UButton
            :variant="inputMode === 'iterate' ? 'link' : 'link'"
            :color="inputMode === 'iterate' ? 'neutral' : 'neutral'"
            size="sm"
            icon="i-lucide-repeat"
            class="rounded-full relative z-10 transition-colors duration-200 px-4"
            :class="inputMode === 'iterate' ? 'text-white' : 'text-muted'"
            :disabled="isChatting || generatingInline"
            @click="inputMode = 'iterate'"
          >
            Iterate
          </UButton>
        </div>

        <!-- Chat Input -->
        <ChatInputArea
          v-if="inputMode === 'chat'"
          v-model="chatInput"
          placeholder="Describe what you want to create or ask for ideas..."
          :disabled="isChatting || generatingInline || isIterating"
          :loading="isChatting"
          @submit="sendChatMessage()"
        />

        <!-- Iteration Form -->
        <ChatIterationForm
          v-else
          v-model:iteration-prompt="iterationPrompt"
          v-model:iteration-goal="iterationGoal"
          v-model:iteration-context="iterationContext"
          v-model:is-form-collapsed="isFormCollapsed"
          :iteration-pass-count="iterationPassCount"
          :is-iterating="isIterating"
          :is-chatting="isChatting"
          :generating-inline="generatingInline"
          @update:iteration-pass-count="setIterationPassCount"
          @submit="startIterationRun()"
          @stop="stopIterationRun"
        />

        <p v-if="inputMode === 'chat'" class="text-center text-[11px] text-dimmed hidden md:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>

    <GalleryViewer />
  </div>
</template>
