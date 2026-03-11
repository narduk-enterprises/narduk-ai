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

const { createElement, deleteElement, updateElement } = usePromptElements()
const { generateImage, generating: generatingPreview } = useGenerate()

// IMPORTANT: Keep elements in sync — after any create/delete/update,
// always call fetchElements() which updates the array from useChatForm.
// Do NOT rely on createElement's local unshift since it operates on
// a different composable instance.

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
const isLibraryOpen = ref(true)
const isBuilderOpen = ref(true)

const PERSON_ATTRIBUTES = [
  'name',
  'age',
  'gender',
  'ethnicity',
  'body_type',
  'height',
  'skin_tone',
  'hair_color',
  'hair_style',
  'eye_color',
  'face_shape',
  'expression',
  'clothing',
  'accessories',
  'makeup',
  'tattoos_piercings',
  'vibe',
  'distinguishing_features',
] as const

// Editable overrides — user can directly edit attribute values
const editableOverrides = reactive<Record<string, string | null>>({})
const previewImageUrl = ref<string | null>(null)
const headshotUrl = ref<string | null>(null)
const currentPresetId = ref<string | null>(null)

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
      title: 'Saved to Presets',
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

/** Load a saved preset's content as builder state attributes */
function loadPresetAsBuilderState(
  content: string,
  type: string,
  metadata?: string | null,
  elementId?: string,
) {
  // Parse "Key: value" lines into an editable state
  const lines = content.split('\n').filter((l) => l.trim())
  const parsed: Record<string, string> = {}
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase().replaceAll(' ', '_')
      const val = line.slice(colonIdx + 1).trim()
      if (val) parsed[key] = val
    }
  }

  // Switch to the right builder mode if needed
  if (type !== 'general' && type !== chatMode.value) {
    chatMode.value = type as 'person' | 'scene' | 'framing' | 'action'
  }

  // Inject as a synthetic assistant message with builder_state
  const builderState =
    chatMode.value === 'person'
      ? Object.fromEntries(PERSON_ATTRIBUTES.map((a) => [a, parsed[a] || null]))
      : parsed

  chatMessages.value.push({
    role: 'assistant',
    content: JSON.stringify({
      message: `Loaded preset attributes. You can edit any attribute directly.`,
      prompt: null,
      suggested_name: parsed.name || null,
      builder_state: builderState,
    }),
    parsedResponse: {
      message: 'Loaded preset attributes. You can edit any attribute directly.',
      prompt: null,
      suggested_name: parsed.name || null,
      builder_state: builderState,
    },
  })

  // Clear any previous overrides
  for (const key of Object.keys(editableOverrides)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing reactive object
    delete editableOverrides[key]
  }

  // Load saved preview images from metadata
  previewImageUrl.value = null
  headshotUrl.value = null
  if (metadata) {
    try {
      const meta = JSON.parse(metadata)
      if (meta.fullBodyUrl) previewImageUrl.value = meta.fullBodyUrl
      if (meta.headshotUrl) headshotUrl.value = meta.headshotUrl
    } catch {
      /* ignore invalid JSON */
    }
  }

  // Track preset for auto-save
  currentPresetId.value = elementId ?? null

  isMobileLibraryOpen.value = false
}

function formatKey(key: string | number) {
  return String(key).replaceAll('_', ' ')
}

/** Start a fresh builder chat in the given mode */
function startNewBuilderChat(type: string) {
  const mode = type as 'person' | 'scene' | 'framing' | 'action'
  // Clear overrides and preview
  for (const key of Object.keys(editableOverrides)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing reactive object
    delete editableOverrides[key]
  }
  previewImageUrl.value = null
  // Switch mode (watcher in composable will reset messages and reinitialize)
  chatMode.value = mode
  isMobileLibraryOpen.value = false
}

async function handleDeletePreset(id: string, name: string) {
  try {
    await deleteElement(id)
    toast.add({
      title: 'Preset Deleted',
      description: `"${name}" has been removed.`,
      icon: 'i-lucide-trash-2',
      color: 'success',
    })
    await fetchElements()
  } catch (_err) {
    toast.add({
      title: 'Delete Failed',
      description: 'Could not delete the preset.',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  }
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

/** Merges actual builder state with the full attribute schema and user edits */
const mergedBuilderState = computed(() => {
  const state = currentBuilderState.value
  if (!state) return null
  if (chatMode.value !== 'person') {
    // For non-person modes, just apply overrides
    return { ...state, ...editableOverrides }
  }

  const merged: Record<string, string | null> = {}
  for (const attr of PERSON_ATTRIBUTES) {
    // Priority: editableOverrides > state from Grok > null
    merged[attr] = editableOverrides[attr] ?? state[attr] ?? null
  }
  // Include any extra attributes Grok returned that aren't in our schema
  for (const [key, val] of Object.entries(state)) {
    if (!(key in merged)) merged[key] = editableOverrides[key] ?? val
  }
  return merged
})

/** Update a single attribute via inline editing */
function updateAttribute(key: string, value: string) {
  if (value.trim()) {
    editableOverrides[key] = value.trim()
  } else {
    editableOverrides[key] = null
  }
}

// Reset editable overrides when mode changes
watch(chatMode, () => {
  for (const key of Object.keys(editableOverrides)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing reactive object
    delete editableOverrides[key]
  }
  previewImageUrl.value = null
  headshotUrl.value = null
  currentPresetId.value = null
})

// Reset overrides when a NEW assistant message arrives with fresh builder_state
watch(
  () => chatMessages.value.length,
  () => {
    const lastMsg = chatMessages.value[chatMessages.value.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg.parsedResponse?.builder_state) {
      for (const key of Object.keys(editableOverrides)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing reactive object
        delete editableOverrides[key]
      }
    }
  },
)

const savingBuilder = ref(false)
const toast = useToast()

async function saveBuilderState() {
  const state = mergedBuilderState.value
  if (!state) return

  // Build content from merged state (includes user edits)
  const content = Object.entries(state)
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `${String(k).charAt(0).toUpperCase() + String(k).slice(1).replaceAll('_', ' ')}: ${v}`,
    )
    .join('\n')

  // Auto-name: use name attribute, suggested_name, or fallback
  const nameFromState = state.name || null
  const lastAssistant = [...chatMessages.value].reverse().find((m) => m.role === 'assistant')
  const name =
    nameFromState || lastAssistant?.parsedResponse?.suggested_name || `New ${chatMode.value}`

  savingBuilder.value = true
  try {
    const payloadType = chatMode.value as 'person' | 'scene' | 'framing' | 'action'
    // Build metadata JSON with preview image URLs
    const metadata: Record<string, string | null> = {}
    if (headshotUrl.value) metadata.headshotUrl = headshotUrl.value
    if (previewImageUrl.value) metadata.fullBodyUrl = previewImageUrl.value
    const metadataStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
    const created = await createElement(payloadType, name, content, metadataStr)
    currentPresetId.value = created?.id ?? null
    toast.add({
      title: 'Preset Saved',
      description: `"${name}" has been added to your ${chatMode.value} presets.`,
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

/** Generate headshot + full-body preview images of the current person */
async function generatePersonPreview() {
  const state = mergedBuilderState.value
  if (!state) return

  // Compile filled attributes into a portrait prompt
  const attrs = Object.entries(state)
    .filter(([k, v]) => v && k !== 'name')
    .map(([k, v]) => `${formatKey(k)}: ${v}`)
    .join(', ')

  const fullBodyPrompt = `Full body portrait photograph of a person: ${attrs}. Standing pose facing the viewer, plain white background, studio lighting, clean and simple, fashion lookbook style, no distractions, high quality, photorealistic.`
  const headshotPrompt = `Professional headshot portrait of a person: ${attrs}. Close-up face and shoulders, plain white background, studio lighting, sharp focus, high quality, photorealistic.`

  previewImageUrl.value = null
  headshotUrl.value = null

  // Generate both in parallel
  const [fullBodyResult, headshotResult] = await Promise.allSettled([
    generateImage(fullBodyPrompt, '9:16'),
    generateImage(headshotPrompt, '1:1'),
  ])

  if (fullBodyResult.status === 'fulfilled' && fullBodyResult.value?.mediaUrl) {
    previewImageUrl.value = fullBodyResult.value.mediaUrl
  }
  if (headshotResult.status === 'fulfilled' && headshotResult.value?.mediaUrl) {
    headshotUrl.value = headshotResult.value.mediaUrl
  }

  if (!previewImageUrl.value && !headshotUrl.value) {
    toast.add({
      title: 'Preview Failed',
      description: 'Could not generate preview images.',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  }
}

// ─── Debounced Auto-Save ───────────────────────────────────
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_DELAY = 1500 // 1.5s debounce

function buildCurrentContent() {
  const state = mergedBuilderState.value
  if (!state) return null
  return Object.entries(state)
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `${String(k).charAt(0).toUpperCase() + String(k).slice(1).replaceAll('_', ' ')}: ${v}`,
    )
    .join('\n')
}

function buildCurrentMetadata() {
  const meta: Record<string, string | null> = {}
  if (headshotUrl.value) meta.headshotUrl = headshotUrl.value
  if (previewImageUrl.value) meta.fullBodyUrl = previewImageUrl.value
  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
}

function scheduleAutoSave() {
  if (!currentPresetId.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    const id = currentPresetId.value
    if (!id) return
    const content = buildCurrentContent()
    if (!content) return
    try {
      await updateElement(id, {
        content,
        metadata: buildCurrentMetadata(),
      })
      await fetchElements()
    } catch {
      /* silent — saves are best-effort */
    }
  }, AUTO_SAVE_DELAY)
}

// Watch for changes that should trigger auto-save
watch([() => JSON.stringify(mergedBuilderState.value), headshotUrl, previewImageUrl], () =>
  scheduleAutoSave(),
)

// Also trigger auto-save on inline attribute edits
watch(
  () => JSON.stringify(editableOverrides),
  () => scheduleAutoSave(),
)

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
  <div class="h-[calc(100dvh-4rem)] flex overflow-hidden bg-default">
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
          Presets
        </UButton>
      </div>

      <!-- Floating Builder State for Mobile -->
      <div
        v-if="mergedBuilderState"
        class="md:hidden p-3 border-b border-primary/20 bg-primary/5 shrink-0 flex items-center justify-between"
      >
        <span class="text-sm font-semibold text-primary capitalize flex items-center gap-1.5">
          <UIcon name="i-lucide-hammer" class="size-4" />
          {{ chatMode }} ({{
            Object.values(mergedBuilderState).filter((v) => v !== null).length
          }}/{{ Object.keys(mergedBuilderState).length }})
        </span>
        <UButton size="xs" color="primary" variant="soft" @click="isMobileLibraryOpen = true"
          >View & Save</UButton
        >
      </div>

      <!-- Message History -->
      <div ref="chatScrollContainer" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-4">
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
                ? 'bg-primary text-white rounded-tr-sm'
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
                      Save to Presets
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
              <div class="p-3 sm:p-4">
                <div class="flex items-center gap-2 mb-2">
                  <img
                    v-if="headshotUrl"
                    :src="headshotUrl"
                    alt="Headshot"
                    class="size-7 rounded-full object-cover ring-1 ring-primary/30 shrink-0"
                  />
                  <UIcon v-else name="i-lucide-hammer" class="size-4 text-primary" />
                  <span class="text-xs font-semibold text-primary capitalize"
                    >{{ chatMode }} Attributes</span
                  >
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <div
                    v-for="(val, key) in chatMode === 'person'
                      ? Object.fromEntries(
                          PERSON_ATTRIBUTES.map((a) => [
                            a,
                            msg.parsedResponse!.builder_state![a] ?? null,
                          ]),
                        )
                      : msg.parsedResponse!.builder_state"
                    :key="key"
                    class="text-xs p-1.5 rounded-md border"
                    :class="
                      val
                        ? 'bg-elevated border-default'
                        : 'bg-default border-dashed border-default/50'
                    "
                  >
                    <span
                      class="font-medium capitalize text-[10px] block"
                      :class="val ? 'text-primary' : 'text-dimmed'"
                      >{{ formatKey(key) }}</span
                    >
                    <!-- eslint-disable-next-line narduk/no-native-input -- Lightweight inline edit, UInput too heavy here -->
                    <input
                      :value="editableOverrides[String(key)] ?? (val || '')"
                      :placeholder="'...'"
                      class="w-full bg-transparent text-default text-xs border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-0.5 placeholder:text-dimmed placeholder:italic"
                      @change="
                        updateAttribute(String(key), ($event.target as HTMLInputElement).value)
                      "
                    />
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
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
                    v-if="chatMode === 'person'"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-eye"
                    size="sm"
                    :loading="generatingPreview"
                    @click="generatePersonPreview"
                  >
                    Preview
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-bookmark-plus"
                    size="sm"
                    :loading="savingBuilder"
                    @click="saveBuilderState"
                  >
                    Save
                  </UButton>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Preview Images Inline -->
        <div
          v-if="previewImageUrl || headshotUrl"
          class="flex self-start items-end gap-3 max-w-[80%] animate-fade-in-up"
        >
          <div v-if="headshotUrl" class="w-28 shrink-0">
            <MediaPlayer :src="headshotUrl" type="image" alt="Headshot" />
          </div>
          <div v-if="previewImageUrl" class="max-w-xs">
            <MediaPlayer :src="previewImageUrl" type="image" alt="Full Body" />
          </div>
        </div>
        <p v-if="previewImageUrl || headshotUrl" class="text-xs text-dimmed mt-1 ml-1">
          Tap to zoom
        </p>

        <!-- Preview Loading -->
        <div
          v-else-if="generatingPreview"
          class="flex self-start items-center gap-3 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%] animate-fade-in-up"
        >
          <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-primary" />
          <span class="text-sm text-muted">Generating preview...</span>
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
      <div
        class="px-3 pt-3 md:px-6 md:pt-4 md:pb-8 bg-default border-t border-default/50 shrink-0 pb-safe"
      >
        <UForm
          :state="{ input: chatInput }"
          @submit.prevent="sendChatMessage"
          class="max-w-4xl mx-auto flex items-end gap-2"
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

    <!-- Desktop Library Sidebar -->
    <aside
      class="hidden md:flex flex-col w-80 lg:w-96 border-l border-default/50 bg-elevated shrink-0"
    >
      <!-- Builder State Panel -->
      <div v-if="mergedBuilderState" class="border-b border-default/50 bg-primary/5 shrink-0">
        <div class="p-4 cursor-pointer select-none" @click="isBuilderOpen = !isBuilderOpen">
          <div class="flex items-center justify-between">
            <h2 class="font-display font-semibold flex items-center gap-2 text-primary capitalize">
              <UIcon name="i-lucide-hammer" class="size-5" />
              Current {{ chatMode }}
            </h2>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted tabular-nums">
                {{ Object.values(mergedBuilderState).filter((v) => v !== null).length }}/{{
                  Object.keys(mergedBuilderState).length
                }}
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 text-muted transition-transform duration-200"
                :class="isBuilderOpen ? 'rotate-180' : ''"
              />
            </div>
          </div>
        </div>
        <div v-show="isBuilderOpen" class="px-4 pb-4">
          <!-- Preview Image (headshot only in sidebar) -->
          <div
            v-if="headshotUrl || previewImageUrl"
            class="mb-4 max-w-[50%] mx-auto rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
          >
            <MediaPlayer
              :src="(headshotUrl || previewImageUrl)!"
              type="image"
              alt="Person Preview"
            />
          </div>
          <div class="space-y-2 mb-4 max-h-[calc(100dvh-24rem)] overflow-y-auto">
            <div
              v-for="(val, key) in mergedBuilderState"
              :key="key"
              class="text-sm flex flex-col p-2 rounded-lg border transition-colors"
              :class="
                val
                  ? 'bg-elevated border-default shadow-sm hover:border-primary/50'
                  : 'bg-default border-dashed border-default/50'
              "
            >
              <span
                class="font-medium capitalize text-xs mb-0.5"
                :class="val ? 'text-primary' : 'text-dimmed'"
                >{{ formatKey(key) }}</span
              >
              <!-- eslint-disable-next-line narduk/no-native-input -- Lightweight inline edit -->
              <input
                :value="editableOverrides[String(key)] ?? (val || '')"
                :placeholder="'Set ' + formatKey(key) + '...'"
                class="w-full bg-transparent text-default text-sm border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 placeholder:text-dimmed placeholder:italic placeholder:text-xs"
                @change="updateAttribute(String(key), ($event.target as HTMLInputElement).value)"
              />
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
            <div class="flex gap-2">
              <UButton
                v-if="chatMode === 'person'"
                class="flex-1"
                color="neutral"
                variant="outline"
                icon="i-lucide-eye"
                :loading="generatingPreview"
                @click="generatePersonPreview"
              >
                Preview
              </UButton>
              <UButton
                class="flex-1"
                color="neutral"
                variant="soft"
                icon="i-lucide-save"
                :loading="savingBuilder"
                @click="saveBuilderState"
              >
                Save
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <div
        class="p-4 border-b border-default/50 glass z-10 shrink-0 cursor-pointer select-none"
        @click="isLibraryOpen = !isLibraryOpen"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-display font-semibold text-lg flex items-center gap-2">
            <UIcon name="i-lucide-library" class="size-5 text-primary" />
            Preset Library
          </h2>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-5 text-muted transition-transform duration-200"
            :class="isLibraryOpen ? 'rotate-180' : ''"
          />
        </div>
      </div>
      <div v-show="isLibraryOpen" class="flex-1 overflow-y-auto p-4 space-y-6">
        <div v-for="(items, type) in groupedElements" :key="type">
          <template v-if="items.length > 0">
            <div class="flex items-center justify-between mb-3 ml-1">
              <h3 class="text-xs font-semibold text-muted uppercase tracking-wider">{{ type }}s</h3>
              <UButton
                v-if="type !== 'prompt'"
                variant="ghost"
                color="primary"
                icon="i-lucide-plus"
                size="xs"
                class="-mr-1"
                :title="`New ${type} chat`"
                @click="startNewBuilderChat(String(type))"
              />
            </div>
            <div class="space-y-2">
              <UButton
                v-for="el in items"
                :key="el.id"
                variant="ghost"
                color="neutral"
                block
                class="justify-start text-left h-auto py-2.5 hover:bg-default shadow-sm border border-transparent hover:border-default group transition-all"
                @click="loadPresetAsBuilderState(el.content, el.type, el.metadata, el.id)"
              >
                <div class="flex items-center gap-2 flex-1 overflow-hidden">
                  <img
                    v-if="el.metadata && JSON.parse(el.metadata).headshotUrl"
                    :src="JSON.parse(el.metadata).headshotUrl"
                    :alt="el.name"
                    class="size-8 rounded-full object-cover shrink-0 ring-1 ring-default"
                  />
                  <div class="flex flex-col flex-1 overflow-hidden">
                    <span class="text-sm font-medium text-default truncate">{{ el.name }}</span>
                    <span class="text-xs text-dimmed truncate">{{ el.content }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                  <UIcon
                    name="i-lucide-arrow-left-to-line"
                    class="size-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                  />
                  <UButton
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    size="xs"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop="handleDeletePreset(el.id, el.name)"
                  />
                </div>
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
              Presets
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
            v-if="mergedBuilderState"
            class="p-4 border-b border-default/50 bg-primary/5 shrink-0"
          >
            <div class="flex items-center justify-between mb-3">
              <h2
                class="font-display font-semibold flex items-center gap-2 text-primary capitalize"
              >
                <UIcon name="i-lucide-hammer" class="size-5" />
                Current {{ chatMode }}
              </h2>
              <span class="text-xs text-muted tabular-nums">
                {{ Object.values(mergedBuilderState).filter((v) => v !== null).length }}/{{
                  Object.keys(mergedBuilderState).length
                }}
              </span>
            </div>
            <!-- Preview Image (headshot only in slideover) -->
            <div
              v-if="headshotUrl || previewImageUrl"
              class="mb-4 max-w-[50%] mx-auto rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
            >
              <MediaPlayer
                :src="(headshotUrl || previewImageUrl)!"
                type="image"
                alt="Person Preview"
              />
            </div>
            <div class="space-y-2 mb-4">
              <div
                v-for="(val, key) in mergedBuilderState"
                :key="key"
                class="text-sm flex flex-col p-2 rounded-lg border"
                :class="
                  val
                    ? 'bg-elevated border-default shadow-sm'
                    : 'bg-default border-dashed border-default/50'
                "
              >
                <span
                  class="font-medium capitalize text-xs mb-0.5"
                  :class="val ? 'text-primary' : 'text-dimmed'"
                  >{{ formatKey(key) }}</span
                >
                <!-- eslint-disable-next-line narduk/no-native-input -- Lightweight inline edit -->
                <input
                  :value="editableOverrides[String(key)] ?? (val || '')"
                  :placeholder="'Set ' + formatKey(key) + '...'"
                  class="w-full bg-transparent text-default text-sm border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1 placeholder:text-dimmed placeholder:italic placeholder:text-xs"
                  @change="updateAttribute(String(key), ($event.target as HTMLInputElement).value)"
                />
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
              <div class="flex gap-2">
                <UButton
                  v-if="chatMode === 'person'"
                  class="flex-1"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-eye"
                  :loading="generatingPreview"
                  @click="generatePersonPreview"
                >
                  Preview
                </UButton>
                <UButton
                  class="flex-1"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-save"
                  :loading="savingBuilder"
                  @click="saveBuilderState"
                >
                  Save
                </UButton>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <div v-for="(items, type) in groupedElements" :key="type">
              <template v-if="items.length > 0">
                <div class="flex items-center justify-between mb-2 ml-1">
                  <h3 class="text-xs font-semibold text-muted uppercase tracking-wider">
                    {{ type }}s
                  </h3>
                  <UButton
                    v-if="type !== 'prompt'"
                    variant="ghost"
                    color="primary"
                    icon="i-lucide-plus"
                    size="xs"
                    class="-mr-1"
                    :title="`New ${type} chat`"
                    @click="startNewBuilderChat(String(type))"
                  />
                </div>
                <div class="space-y-2">
                  <UButton
                    v-for="el in items"
                    :key="el.id"
                    variant="soft"
                    color="neutral"
                    block
                    class="justify-start text-left h-auto py-3 group"
                    @click="loadPresetAsBuilderState(el.content, el.type, el.metadata, el.id)"
                  >
                    <div class="flex items-center gap-2 flex-1 overflow-hidden">
                      <img
                        v-if="el.metadata && JSON.parse(el.metadata).headshotUrl"
                        :src="JSON.parse(el.metadata).headshotUrl"
                        :alt="el.name"
                        class="size-8 rounded-full object-cover shrink-0 ring-1 ring-default"
                      />
                      <div class="flex flex-col flex-1 overflow-hidden">
                        <span class="text-sm font-medium text-default truncate">{{ el.name }}</span>
                        <span class="text-xs text-dimmed truncate">{{ el.content }}</span>
                      </div>
                    </div>
                    <UButton
                      variant="ghost"
                      color="error"
                      icon="i-lucide-trash-2"
                      size="xs"
                      class="shrink-0 ml-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                      @click.stop="handleDeletePreset(el.id, el.name)"
                    />
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
