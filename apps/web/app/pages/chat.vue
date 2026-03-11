<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Prompt Brainstorm — Narduk AI',
  description: 'Brainstorm and refine AI generation prompts with Grok.',
})
useWebPageSchema({
  name: 'Prompt Brainstorm — Narduk AI',
  description: 'Brainstorm and refine AI generation prompts with Grok.',
})

const {
  elements,
  fetchElements,
  chatMode,
  chatMessages,
  chatInput,
  isChatting,
  error,
  initializeChat,
  sendChatMessage,
} = useChatForm()

const { createElement } = usePromptElements()

const chatScrollContainer = ref<HTMLElement | null>(null)

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

watch(
  () => chatMessages.value.length,
  () => scrollToBottom(),
)

watch(isChatting, () => scrollToBottom())

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessage()
  }
}

const isMobileLibraryOpen = ref(false)

function useGeneratedPrompt(promptText: string) {
  navigateTo({ path: '/generate', query: { prompt: promptText } })
}

async function savePromptToLibrary(promptText: string) {
  const elementType = chatMode.value === 'general' ? 'scene' : chatMode.value

  // Auto-name from Grok's suggested_name in the latest assistant message
  const lastAssistant = [...chatMessages.value].reverse().find((m) => m.role === 'assistant')
  const name =
    lastAssistant?.parsedResponse?.suggested_name ||
    `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} preset`

  savingBuilder.value = true
  try {
    const payloadType = elementType as 'person' | 'scene' | 'framing' | 'action' | 'prompt'
    await createElement(payloadType, name, promptText)
    toast.add({
      title: 'Saved to Library',
      description: `"${name}" has been added to your ${elementType} presets.`,
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    await fetchElements()
  } catch (_err) {
    toast.add({
      title: 'Failed to Save',
      description: 'An error occurred while saving the preset.',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  } finally {
    savingBuilder.value = false
  }
}

function insertIntoChat(text: string) {
  chatInput.value = chatInput.value ? `${chatInput.value}\n\n${text}` : text
  isMobileLibraryOpen.value = false
}

function formatKey(key: string | number) {
  return String(key).replaceAll('_', ' ')
}

function finalizeBuilderAsPrompt() {
  chatInput.value =
    "Now compile all of the attributes we've built so far into a complete, detailed image generation prompt. Return it in the prompt field."
  sendChatMessage()
}

const modeOptions = [
  { label: 'General Chat', value: 'general' },
  { label: 'Person Builder', value: 'person' },
  { label: 'Scene Builder', value: 'scene' },
  { label: 'Framing Builder', value: 'framing' },
  { label: 'Action Builder', value: 'action' },
]

const currentBuilderState = computed(() => {
  if (chatMode.value === 'general') return null
  // find the latest assistant message with a builder_state
  for (let i = chatMessages.value.length - 1; i >= 0; i--) {
    const msg = chatMessages.value[i]
    if (
      msg &&
      msg.role === 'assistant' &&
      msg.parsedResponse?.builder_state &&
      Object.keys(msg.parsedResponse.builder_state).length > 0
    ) {
      return msg.parsedResponse.builder_state
    }
  }
  return null
})

const savingBuilder = ref(false)
const toast = useToast()

async function saveBuilderState() {
  if (!currentBuilderState.value) return

  const content = Object.entries(currentBuilderState.value)
    .map(
      ([k, v]) =>
        `${String(k).charAt(0).toUpperCase() + String(k).slice(1).replaceAll('_', ' ')}: ${v}`,
    )
    .join('\n')

  const name = prompt(`Enter a name for this ${chatMode.value} preset:`, `New ${chatMode.value}`)
  if (!name) return

  savingBuilder.value = true
  try {
    const payloadType = chatMode.value as 'person' | 'scene' | 'framing' | 'action'
    await createElement(payloadType, name, content)
    toast.add({
      title: 'Preset Saved',
      description: `Your ${chatMode.value} preset has been added to the library.`,
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
  } catch (_err) {
    toast.add({
      title: 'Failed to Save',
      description: 'An error occurred while saving the preset.',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  } finally {
    savingBuilder.value = false
  }
}

// Group elements for the library sidebar
const groupedElements = computed(() => {
  const groups: Record<string, typeof elements.value> = {
    person: [],
    scene: [],
    framing: [],
    action: [],
  }

  for (const el of elements.value) {
    if (groups[el.type]) {
      groups[el.type]!.push(el)
    } else {
      groups[el.type] = [el]
    }
  }
  return groups
})
</script>

<template>
  <div class="h-[calc(100vh-4rem)] flex overflow-hidden bg-default">
    <!-- Chat Area -->
    <div class="flex-1 flex flex-col h-full bg-default relative">
      <!-- Header -->
      <div
        class="h-14 border-b border-default/50 px-4 md:px-6 flex items-center justify-between shrink-0 glass z-10"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-bot" class="size-6 text-primary hidden sm:block" />
          <h1 class="font-display font-semibold text-lg hidden sm:block">Brainstorm</h1>
          <USelect v-model="chatMode" :items="modeOptions" class="w-40 sm:w-44 ml-0 sm:ml-2" />
        </div>

        <!-- Mobile Library Toggle -->
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-bookmark"
          class="md:hidden"
          @click="isMobileLibraryOpen = true"
        >
          Library
        </UButton>
      </div>

      <!-- Floating Builder State for Mobile -->
      <div
        v-if="currentBuilderState"
        class="md:hidden p-3 border-b border-primary/20 bg-primary/5 shrink-0 flex items-center justify-between"
      >
        <span class="text-sm font-semibold text-primary capitalize flex items-center gap-1.5">
          <UIcon name="i-lucide-hammer" class="size-4" />
          {{ chatMode }} State ({{ Object.keys(currentBuilderState).length }})
        </span>
        <UButton size="xs" color="primary" variant="soft" @click="isMobileLibraryOpen = true"
          >View & Save</UButton
        >
      </div>

      <!-- Message History -->
      <div ref="chatScrollContainer" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <UAlert
          v-if="error"
          color="error"
          icon="i-lucide-alert-triangle"
          :title="error"
          class="mb-4"
        />

        <div
          v-for="(msg, index) in chatMessages.filter((m) => m.role !== 'system')"
          :key="index"
          class="flex flex-col max-w-[90%] md:max-w-[80%]"
          :class="msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'"
        >
          <!-- Chat Bubble -->
          <div
            v-if="msg.parsedResponse?.message || (!msg.parsedResponse && msg.content)"
            class="p-4 rounded-2xl whitespace-pre-wrap text-sm md:text-base leading-relaxed"
            :class="[
              msg.role === 'user'
                ? 'bg-primary text-primary-inverted rounded-tr-sm'
                : 'bg-elevated text-default border border-default rounded-tl-sm shadow-sm',
            ]"
          >
            {{ msg.parsedResponse ? msg.parsedResponse.message : msg.content }}
          </div>

          <!-- Generated Prompt Card -->
          <div v-if="msg.parsedResponse?.prompt" class="mt-3 w-full animate-fade-in-up">
            <UCard class="ring-1 ring-primary/20 bg-primary/5">
              <div class="p-4 sm:p-5 flex items-start gap-3">
                <UIcon name="i-lucide-sparkles" class="size-5 text-primary shrink-0 mt-0.5" />
                <div class="flex-1 space-y-3">
                  <p class="text-sm font-medium text-default leading-relaxed font-mono select-all">
                    {{ msg.parsedResponse.prompt }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/10">
                    <UButton
                      color="primary"
                      variant="solid"
                      icon="i-lucide-wand-2"
                      size="sm"
                      @click="useGeneratedPrompt(msg.parsedResponse.prompt!)"
                    >
                      Use This Prompt
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-bookmark-plus"
                      size="sm"
                      :loading="savingBuilder"
                      @click="savePromptToLibrary(msg.parsedResponse.prompt!)"
                    >
                      Save to Library
                    </UButton>
                    <CopyPromptButton :prompt="msg.parsedResponse.prompt" />
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Inline Builder State Card (when builder mode returns state but no prompt) -->
          <div
            v-if="
              chatMode !== 'general' &&
              msg.parsedResponse?.builder_state &&
              Object.keys(msg.parsedResponse.builder_state).length > 0 &&
              !msg.parsedResponse?.prompt
            "
            class="mt-3 w-full animate-fade-in-up"
          >
            <UCard class="ring-1 ring-primary/20 bg-primary/5">
              <div class="p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-3">
                  <UIcon name="i-lucide-hammer" class="size-5 text-primary" />
                  <span class="text-sm font-semibold text-primary capitalize"
                    >{{ chatMode }} Attributes</span
                  >
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  <div
                    v-for="(val, key) in msg.parsedResponse.builder_state"
                    :key="key"
                    class="text-sm bg-elevated p-2 rounded-lg border border-default"
                  >
                    <span class="font-medium text-primary capitalize text-xs">{{
                      formatKey(key)
                    }}</span>
                    <p class="text-default leading-snug mt-0.5">{{ val }}</p>
                  </div>
                </div>
                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-sparkles"
                  size="sm"
                  :loading="isChatting"
                  @click="finalizeBuilderAsPrompt"
                >
                  Finalize as Prompt
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-bookmark-plus"
                  size="sm"
                  :loading="savingBuilder"
                  @click="saveBuilderState"
                >
                  Save {{ chatMode }} to Library
                </UButton>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div
          v-if="isChatting"
          class="flex self-start items-center gap-1.5 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%]"
        >
          <span
            class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"
          ></span>
          <span
            class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"
          ></span>
          <span class="size-2 rounded-full bg-primary animate-bounce"></span>
        </div>
      </div>

      <!-- Input Area -->
      <div class="p-4 md:p-6 bg-default border-t border-default/50 shrink-0">
        <UForm
          :state="{ input: chatInput }"
          @submit.prevent="sendChatMessage"
          class="flex gap-3 max-w-4xl mx-auto relative"
        >
          <UTextarea
            v-model="chatInput"
            placeholder="Describe what you want to create or ask for ideas..."
            class="w-full flex-1"
            size="lg"
            autoresize
            :rows="1"
            :maxrows="5"
            :disabled="isChatting"
            :ui="{ base: 'pr-14 rounded-2xl shadow-sm' }"
            @keydown="handleKeydown"
          />
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            icon="i-lucide-send"
            :loading="isChatting"
            :disabled="!chatInput.trim() || isChatting"
            class="absolute right-2 bottom-2 rounded-xl"
            size="sm"
          />
        </UForm>
      </div>
    </div>

    <!-- Desktop Library Sidebar -->
    <aside
      class="hidden md:flex flex-col w-80 lg:w-96 border-l border-default/50 bg-elevated shrink-0"
    >
      <!-- Builder State Panel -->
      <div v-if="currentBuilderState" class="p-4 border-b border-default/50 bg-primary/5 shrink-0">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display font-semibold flex items-center gap-2 text-primary capitalize">
            <UIcon name="i-lucide-hammer" class="size-5" />
            Current {{ chatMode }}
          </h2>
        </div>
        <div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
          <div
            v-for="(val, key) in currentBuilderState"
            :key="key"
            class="text-sm flex flex-col bg-elevated p-2 rounded-lg border border-default shadow-sm hover:border-primary/50 transition-colors"
          >
            <span class="font-medium text-primary capitalize text-xs mb-0.5">{{
              formatKey(key)
            }}</span>
            <span class="text-default leading-snug">{{ val }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <UButton
            block
            color="primary"
            icon="i-lucide-sparkles"
            :loading="isChatting"
            @click="finalizeBuilderAsPrompt"
          >
            Finalize as Prompt
          </UButton>
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-lucide-save"
            :loading="savingBuilder"
            @click="saveBuilderState"
          >
            Save as Preset
          </UButton>
        </div>
      </div>

      <div class="p-4 border-b border-default/50 glass z-10 shrink-0">
        <h2 class="font-display font-semibold text-lg flex items-center gap-2">
          <UIcon name="i-lucide-library" class="size-5 text-primary" />
          Prompt Library
        </h2>
        <p class="text-xs text-muted mt-1">Read-only view. Manage in Settings.</p>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <div v-for="(items, type) in groupedElements" :key="type">
          <template v-if="items.length > 0">
            <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3 ml-1">
              {{ type }}s
            </h3>
            <div class="space-y-2">
              <UButton
                v-for="el in items"
                :key="el.id"
                variant="ghost"
                color="neutral"
                block
                class="justify-start text-left h-auto py-2.5 hover:bg-default shadow-sm border border-transparent hover:border-default group transition-all"
                @click="insertIntoChat(el.content)"
              >
                <div class="flex flex-col w-full overflow-hidden">
                  <span class="text-sm font-medium text-default truncate">{{ el.name }}</span>
                  <span class="text-xs text-dimmed truncate">{{ el.content }}</span>
                </div>
                <!-- Inline inject icon hint -->
                <UIcon
                  name="i-lucide-arrow-left-to-line"
                  class="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-primary"
                />
              </UButton>
            </div>
          </template>
        </div>
        <div v-if="elements.length === 0" class="text-center py-8">
          <UIcon name="i-lucide-bookmark-minus" class="size-8 mx-auto text-dimmed mb-3" />
          <p class="text-sm text-muted">Your library is empty.</p>
          <UButton to="/settings" variant="link" size="sm" class="mt-2"
            >Go to Settings to add</UButton
          >
        </div>
      </div>
    </aside>

    <!-- Mobile Library Slideover -->
    <USlideover v-model:open="isMobileLibraryOpen" side="right">
      <template #content>
        <div class="flex flex-col h-full bg-default">
          <div
            class="p-4 border-b border-default/50 flex items-center justify-between shrink-0 glass"
          >
            <h2 class="font-display font-semibold text-lg flex items-center gap-2">
              <UIcon name="i-lucide-library" class="size-5 text-primary" />
              Library
            </h2>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="-mr-2"
              @click="isMobileLibraryOpen = false"
            />
          </div>

          <!-- Mobile Builder State Panel -->
          <div
            v-if="currentBuilderState"
            class="p-4 border-b border-default/50 bg-primary/5 shrink-0"
          >
            <div class="flex items-center justify-between mb-3">
              <h2
                class="font-display font-semibold flex items-center gap-2 text-primary capitalize"
              >
                <UIcon name="i-lucide-hammer" class="size-5" />
                Current {{ chatMode }}
              </h2>
            </div>
            <div class="space-y-2 mb-4">
              <div
                v-for="(val, key) in currentBuilderState"
                :key="key"
                class="text-sm flex flex-col bg-elevated p-2 rounded-lg border border-default shadow-sm"
              >
                <span class="font-medium text-primary capitalize text-xs mb-0.5">{{
                  formatKey(key)
                }}</span>
                <span class="text-default leading-snug">{{ val }}</span>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <UButton
                block
                color="primary"
                icon="i-lucide-sparkles"
                :loading="isChatting"
                @click="finalizeBuilderAsPrompt"
              >
                Finalize as Prompt
              </UButton>
              <UButton
                block
                color="neutral"
                variant="soft"
                icon="i-lucide-save"
                :loading="savingBuilder"
                @click="saveBuilderState"
              >
                Save as Preset
              </UButton>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <div v-for="(items, type) in groupedElements" :key="type">
              <template v-if="items.length > 0">
                <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2 ml-1">
                  {{ type }}s
                </h3>
                <div class="space-y-2">
                  <UButton
                    v-for="el in items"
                    :key="el.id"
                    variant="soft"
                    color="neutral"
                    block
                    class="justify-start text-left h-auto py-3"
                    @click="insertIntoChat(el.content)"
                  >
                    <div class="flex flex-col w-full overflow-hidden">
                      <span class="text-sm font-medium text-default truncate">{{ el.name }}</span>
                      <span class="text-xs text-dimmed truncate">{{ el.content }}</span>
                    </div>
                  </UButton>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
