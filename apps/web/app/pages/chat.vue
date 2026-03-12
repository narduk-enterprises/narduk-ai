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
  generateInline,
  shareImageWithAgent,
  startNewChat,
} = useChatForm({ persistence: 'session', resumeMode: 'general' })

const { createElement, fetchElements } = usePromptElements()

const chatScrollContainer = ref<HTMLElement | null>(null)
const savingPrompt = ref(false)
const toast = useToast()

function scrollToBottom() {
  nextTick(() => {
    if (chatScrollContainer.value) {
      chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight
    }
  })
}

onMounted(() => {
  fetchElements()
  initializeChat()
  scrollToBottom()
})

watch(() => chatMessages.value.length, scrollToBottom)
watch(isChatting, scrollToBottom)
watch(isIterating, scrollToBottom)
watch(generatingInline, scrollToBottom)
watch(() => activeIterationRun.value?.completedIterations ?? 0, scrollToBottom)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessage()
  }
}

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
          @click="startNewChat"
        >
          <span class="hidden sm:inline">New Chat</span>
        </UButton>

        <UButton to="/presets" variant="ghost" color="neutral" icon="i-lucide-bookmark" size="sm">
          <span class="hidden sm:inline">Presets</span>
        </UButton>
      </div>
    </div>

    <!-- Messages -->
    <div ref="chatScrollContainer" class="flex-1 overflow-y-auto p-4 md:p-6">
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
        @use-prompt="useGeneratedPrompt"
        @save-prompt="savePromptToLibrary"
        @generate-inline="handleGenerateInline"
        @share-image="handleShareImage"
        @continue-iteration="handleContinueIteration"
      />
    </div>

    <!-- Input Area -->
    <div
      class="px-3 pt-3 md:px-6 md:pt-4 md:pb-8 bg-default border-t border-default/50 shrink-0 pb-safe"
    >
      <div class="max-w-4xl mx-auto space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            color="neutral"
            size="sm"
            :variant="inputMode === 'chat' ? 'solid' : 'outline'"
            icon="i-lucide-message-square"
            class="rounded-full"
            :disabled="isIterating"
            @click="inputMode = 'chat'"
          >
            Chat
          </UButton>
          <UButton
            color="neutral"
            size="sm"
            :variant="inputMode === 'iterate' ? 'solid' : 'outline'"
            icon="i-lucide-repeat"
            class="rounded-full"
            :disabled="isChatting || generatingInline"
            @click="inputMode = 'iterate'"
          >
            Iterate
          </UButton>
        </div>

        <UForm
          v-if="inputMode === 'chat'"
          :state="{ input: chatInput }"
          class="flex items-end gap-2"
          @submit.prevent="() => sendChatMessage()"
        >
          <UTextarea
            v-model="chatInput"
            placeholder="Describe what you want to create or ask for ideas..."
            class="flex-1"
            size="lg"
            autoresize
            :rows="1"
            :maxrows="4"
            :disabled="isChatting || generatingInline || isIterating"
            :ui="{ base: 'rounded-2xl shadow-card' }"
            @keydown="handleKeydown"
          />
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            icon="i-lucide-send"
            :loading="isChatting"
            :disabled="!chatInput.trim() || isChatting || generatingInline || isIterating"
            class="rounded-xl touch-target shrink-0 mb-0.5"
            size="lg"
          />
        </UForm>

        <UForm
          v-else
          :state="{ prompt: iterationPrompt, goal: iterationGoal }"
          class="space-y-3"
          @submit.prevent="() => startIterationRun()"
        >
          <UFormField label="Starting Prompt">
            <UTextarea
              v-model="iterationPrompt"
              placeholder="Paste the prompt you want to improve..."
              autoresize
              :rows="3"
              :maxrows="7"
              :disabled="isIterating || isChatting || generatingInline"
              :ui="{ base: 'rounded-2xl shadow-card' }"
            />
          </UFormField>
          <UFormField label="Goal">
            <UInput
              v-model="iterationGoal"
              placeholder="What should the prompt get better at?"
              :disabled="isIterating || isChatting || generatingInline"
              size="lg"
              :ui="{ base: 'rounded-2xl shadow-card' }"
            />
          </UFormField>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              type="submit"
              color="primary"
              variant="solid"
              icon="i-lucide-wand-sparkles"
              :loading="isIterating"
              :disabled="
                !iterationPrompt.trim() ||
                !iterationGoal.trim() ||
                isIterating ||
                isChatting ||
                generatingInline
              "
              class="rounded-xl"
              size="lg"
            >
              Run 5 Iterations
            </UButton>
            <UButton
              v-if="isIterating"
              color="neutral"
              variant="outline"
              icon="i-lucide-octagon-x"
              class="rounded-xl"
              size="lg"
              @click="stopIterationRun"
            >
              Stop
            </UButton>
            <p class="text-xs text-dimmed">
              Each pass rewrites the prompt, renders an image, reviews the result, and adjusts for
              the next pass. Stop anytime if it drifts.
            </p>
          </div>
        </UForm>

        <p v-if="inputMode === 'chat'" class="text-center text-[11px] text-dimmed hidden md:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>

    <GalleryViewer />
  </div>
</template>
