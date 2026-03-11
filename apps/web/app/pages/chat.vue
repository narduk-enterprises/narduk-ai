<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Brainstorm — Narduk AI',
  description: 'Brainstorm ideas for AI image and video generation with Grok.',
})
useWebPageSchema({
  name: 'Brainstorm — Narduk AI',
  description: 'Brainstorm ideas for AI image and video generation with Grok.',
})

const { chatMessages, chatInput, isChatting, error, initializeChat, sendChatMessage } =
  useChatForm()

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
      <UButton to="/presets" variant="ghost" color="neutral" icon="i-lucide-bookmark" size="sm">
        Presets
      </UButton>
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
        @use-prompt="useGeneratedPrompt"
        @save-prompt="savePromptToLibrary"
      />
    </div>

    <!-- Input Area -->
    <div
      class="px-3 pt-3 md:px-6 md:pt-4 md:pb-8 bg-default border-t border-default/50 shrink-0 pb-safe"
    >
      <UForm
        :state="{ input: chatInput }"
        class="max-w-4xl mx-auto flex items-end gap-2"
        @submit.prevent="sendChatMessage"
      >
        <UTextarea
          v-model="chatInput"
          placeholder="Describe what you want to create or ask for ideas..."
          class="flex-1"
          size="lg"
          autoresize
          :rows="1"
          :maxrows="4"
          :disabled="isChatting"
          :ui="{ base: 'rounded-2xl shadow-card' }"
          @keydown="handleKeydown"
        />
        <UButton
          type="submit"
          color="primary"
          variant="solid"
          icon="i-lucide-send"
          :loading="isChatting"
          :disabled="!chatInput.trim() || isChatting"
          class="rounded-xl touch-target shrink-0 mb-0.5"
          size="lg"
        />
      </UForm>
      <p class="text-center text-[11px] text-dimmed mt-2 hidden md:block">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  </div>
</template>
