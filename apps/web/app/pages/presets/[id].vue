<script setup lang="ts">
import type { PromptElement } from '~/composables/usePromptElements'
import type { Generation } from '~/types/generation'
import { PRESET_ATTRIBUTES } from '~/composables/usePresetEditor'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const presetId = computed(() => route.params.id as string)

// ── Editor Composable ────────────────────────────────────
const {
  editableOverrides,
  previewImageUrl,
  headshotUrl,
  generatingPreview,
  loadPreset,
  updateAttribute,
  generatePreview,
  mergeBuilderState,
  scheduleAutoSave,
  scheduleChatSave,
  loadChatHistory,
  clearChatHistory,
  fetchPresetById,
  resetState,
} = usePresetEditor()

// ── Load Preset ──────────────────────────────────────────
const {
  data: preset,
  status: loadStatus,
  error: loadError,
  refresh: refreshPreset,
} = await fetchPresetById(presetId)

// ── SEO ──────────────────────────────────────────────────
const pageTitle = computed(() =>
  preset.value ? `${preset.value.name} — Edit Preset` : 'Edit Preset',
)

useSeo({
  title: pageTitle.value,
  description: 'Edit your preset attributes, preview images, and chat with Grok to refine.',
})
useWebPageSchema({
  name: pageTitle.value,
  description: 'Edit a preset in the Narduk AI prompt builder.',
})

// ── Scoped Chat ──────────────────────────────────────────
const { chatMode, chatMessages, chatInput, isChatting, initializeChat, sendChatMessage } =
  useChatForm()

const chatScrollContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (chatScrollContainer.value) {
      chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight
    }
  })
}

watch(() => chatMessages.value.length, scrollToBottom)
watch(isChatting, scrollToBottom)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessage()
  }
}

// ── Initialize When Preset Loads ─────────────────────────
const presetInitialized = ref(false)

async function initPreset(el: PromptElement) {
  loadPreset(el)

  chatMode.value = el.type as 'person' | 'scene' | 'framing' | 'action' | 'style'
  await nextTick()

  // Try loading persisted chat history
  const savedChat = loadChatHistory(el)
  if (savedChat && savedChat.length > 1) {
    const currentSystem = chatMessages.value.find((m) => m.role === 'system')
    if (currentSystem) {
      const nonSystem = savedChat.filter((m) => m.role !== 'system')
      chatMessages.value = [currentSystem, ...nonSystem]
    } else {
      chatMessages.value = savedChat
    }
  } else {
    const lines = el.content.split('\n').filter((l) => l.trim())
    const parsed: Record<string, string> = {}
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase().replaceAll(' ', '_')
        const val = line.slice(colonIdx + 1).trim()
        if (val) parsed[key] = val
      }
    }

    const schema = PRESET_ATTRIBUTES[el.type]
    const builderState = schema
      ? Object.fromEntries(schema.map((a) => [a, parsed[a] || null]))
      : parsed

    chatMessages.value.push({
      role: 'assistant',
      content: JSON.stringify({
        message: `Loaded "${el.name}". Edit attributes directly or ask me to help refine them.`,
        prompt: null,
        suggested_name: el.name,
        builder_state: builderState,
      }),
      parsedResponse: {
        message: `Loaded "${el.name}". Edit attributes directly or ask me to help refine them.`,
        prompt: null,
        suggested_name: el.name,
        builder_state: builderState,
      },
    })
  }

  scrollToBottom()
}

watch(
  preset,
  async (el) => {
    // Only initialize if we have element data AND its ID matches the current route parameter
    if (!el || presetInitialized.value || el.id !== presetId.value) return
    presetInitialized.value = true
    await initPreset(el)
  },
  { immediate: true },
)
// ── Auto-Preview State ───────────────────────────────────
const hasTriggeredAutoPreview = ref(false)

// ── Watch Route for In-Place Preset Switching ─────────────
watch(presetId, async (newId, oldId) => {
  if (!newId || newId === oldId) return
  presetInitialized.value = false
  hasTriggeredAutoPreview.value = false
  resetState()
  chatMessages.value = []
  initializeChat()
  await refreshPreset()
})

// ── Save Chat on Each Exchange ───────────────────────────
watch(
  () => chatMessages.value.length,
  () => {
    if (presetInitialized.value && chatMessages.value.length > 1) {
      scheduleChatSave(chatMessages.value)
    }
  },
)

async function handleClearChat() {
  await clearChatHistory()
  chatMessages.value = []
  initializeChat()
}

// ── Derived State ────────────────────────────────────────
const currentBuilderState = computed(() => {
  if (!preset.value) return null
  for (let i = chatMessages.value.length - 1; i >= 0; i--) {
    const msg = chatMessages.value[i]
    if (
      msg?.role === 'assistant' &&
      msg.parsedResponse?.builder_state &&
      Object.keys(msg.parsedResponse.builder_state).length > 0
    ) {
      return msg.parsedResponse.builder_state
    }
  }
  return null
})

const mergedState = computed(() => {
  if (!currentBuilderState.value || !preset.value) return null
  return mergeBuilderState(currentBuilderState.value, preset.value.type)
})

// ── Auto-Save ────────────────────────────────────────────
watch([() => JSON.stringify(mergedState.value), headshotUrl, previewImageUrl], () =>
  scheduleAutoSave(mergedState.value),
)

watch(
  () => JSON.stringify(editableOverrides),
  () => scheduleAutoSave(mergedState.value),
)

// ── Actions ──────────────────────────────────────────────
function handleGeneratePreview() {
  if (!mergedState.value) return
  generatePreview(mergedState.value, preset.value?.type)
}

function handleUsePrompt(promptText: string) {
  navigateTo({ path: '/generate', query: { prompt: promptText } })
}

async function handleSavePrompt(promptText: string) {
  const elementType = preset.value?.type || 'scene'
  const lastAssistant = [...chatMessages.value].reverse().find((m) => m.role === 'assistant')
  const name =
    lastAssistant?.parsedResponse?.suggested_name ||
    `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} preset`

  const { createElement, fetchElements } = usePromptElements()
  try {
    await createElement(
      elementType as 'person' | 'scene' | 'framing' | 'action' | 'style',
      name,
      promptText,
    )
    const toast = useToast()
    toast.add({
      title: 'Saved to Presets',
      description: `"${name}" added.`,
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    await fetchElements()
  } catch {
    /* handled in composable */
  }
}

const filledCount = computed(() =>
  mergedState.value ? Object.values(mergedState.value).filter((v) => v !== null).length : 0,
)

const totalCount = computed(() => (mergedState.value ? Object.keys(mergedState.value).length : 0))

// ── Reactive Header Name ─────────────────────────────
const displayName = computed(() => {
  // Prefer live attribute name from mergedState, fall back to preset name
  const liveName = mergedState.value?.name
  if (liveName && typeof liveName === 'string') return liveName
  return preset.value?.name || 'Loading...'
})

// ── Save Status Indicator ────────────────────────────
const saveStatus = ref<'saving' | 'saved' | null>(null)
let saveStatusTimer: ReturnType<typeof setTimeout> | null = null

// Watch auto-save triggers to show saving indicator
watch([() => JSON.stringify(mergedState.value), () => JSON.stringify(editableOverrides)], () => {
  if (import.meta.server || !mergedState.value) return
  saveStatus.value = 'saving'
  if (saveStatusTimer) clearTimeout(saveStatusTimer)
  // Show "saved" after auto-save delay + small buffer
  saveStatusTimer = setTimeout(() => {
    saveStatus.value = 'saved'
    // Clear after 3s
    setTimeout(() => {
      saveStatus.value = null
    }, 3000)
  }, 2000)
})

// ── Generation ───────────────────────────────────────────
const { generateImage: callGenerateImage, fetchGenerations } = useGenerate()
const galleryViewer = useGalleryViewer()

const allGenerations = ref<Generation[]>([])
const isGeneratingImage = ref(false)

async function loadGenerations() {
  allGenerations.value = await fetchGenerations(100)
}

onMounted(() => {
  loadGenerations()
})

const presetGenerations = computed(() => {
  const currentPreset = preset.value
  if (!currentPreset || !currentPreset.name) return []
  return allGenerations.value.filter((gen) => {
    if (!gen.presets) return false
    try {
      const parsedPresets = JSON.parse(gen.presets)
      return parsedPresets[currentPreset.type] === currentPreset.name
    } catch {
      return false
    }
  })
})

function openPresetViewer(item: Generation) {
  const idx = presetGenerations.value.findIndex((g) => g.id === item.id)
  galleryViewer.open(presetGenerations.value, idx >= 0 ? idx : 0)
}

function openPreviewInViewer() {
  const url = headshotUrl.value || previewImageUrl.value
  if (!url) return
  const syntheticItem: Generation = {
    id: 'preview',
    userId: '',
    type: 'image',
    mode: 't2i',
    prompt: displayName.value + ' preview',
    sourceGenerationId: null,
    status: 'done',
    xaiRequestId: null,
    r2Key: null,
    mediaUrl: url,
    thumbnailUrl: null,
    duration: null,
    generationTimeMs: null,
    aspectRatio: null,
    resolution: null,
    metadata: null,
    presets: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  galleryViewer.open([syntheticItem], 0)
}

async function handleGenerateImage() {
  if (!mergedState.value || !preset.value) return
  isGeneratingImage.value = true

  const presetMode = preset.value.type
  const attrs = Object.entries(mergedState.value)
    .filter(([k, v]) => v && k !== 'name' && k !== 'description')
    .map(
      ([k, v]) =>
        `${String(k).charAt(0).toUpperCase() + String(k).slice(1).replaceAll('_', ' ')}: ${v}`,
    )
    .join(', ')

  let prompt = ''
  if (presetMode === 'person') {
    prompt = `A portrait photograph of a person: ${attrs}. Realistic, high quality, highly detailed.`
  } else if (presetMode === 'scene') {
    prompt = `A cinematic photograph of a scene: ${attrs}. Cinematic composition, ultra-detailed environment, atmospheric, high quality.`
  } else if (presetMode === 'framing') {
    prompt = `A demonstration of camera framing and composition: ${attrs}. Cinematic quality.`
  } else if (presetMode === 'action') {
    prompt = `A dynamic photograph: ${attrs}. Dramatic lighting, high energy, motion captured, high quality.`
  }

  const presetsToPass = preset.value.name ? { [presetMode]: preset.value.name } : undefined

  try {
    await callGenerateImage(prompt, { aspectRatio: '9:16', presets: presetsToPass })
    useToast().add({
      title: 'Generation Started',
      description: 'Your image is generating!',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
    // Poll/load for a bit to catch the result
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 6000))
      await loadGenerations()
    }
  } catch (err: unknown) {
    useToast().add({
      title: 'Generation Failed',
      description: err instanceof Error ? err.message : 'Unknown error',
      icon: 'i-lucide-alert-triangle',
      color: 'error',
    })
  } finally {
    isGeneratingImage.value = false
  }
}

// ── Auto-Preview on First Full Attributes ────────────────

watch(currentBuilderState, (state) => {
  if (!hasTriggeredAutoPreview.value && state && !previewImageUrl.value && !headshotUrl.value) {
    // Check if enough attributes are filled (at least half)
    const total = Object.keys(state).length
    const filled = Object.values(state).filter((v) => v !== null).length
    if (filled >= Math.ceil(total / 2)) {
      hasTriggeredAutoPreview.value = true
      handleGeneratePreview()
    }
  }
})

// ── Preset List ──────────────────────────────────────────
const { elements, fetchElements } = usePromptElements()
const presetSearch = ref('')
const isMobilePresetsOpen = ref(false)
const isDebugModalOpen = ref(false)

onMounted(() => fetchElements())

const filteredGroupedElements = computed(() => {
  const q = presetSearch.value.toLowerCase().trim()
  const groups: Record<string, typeof elements.value> = {
    person: [],
    scene: [],
    framing: [],
    action: [],
    style: [],
  }
  for (const el of elements.value) {
    if (q && !el.name.toLowerCase().includes(q) && !el.type.toLowerCase().includes(q)) continue
    if (groups[el.type]) groups[el.type]!.push(el)
    else groups[el.type] = [el]
  }
  return groups
})

function parseMeta(metadata: string | null | undefined) {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as {
      headshotUrl?: string
      fullBodyUrl?: string
      previewImageUrl?: string
    }
  } catch {
    return null
  }
}

function presetThumb(metadata: string | null | undefined) {
  const meta = parseMeta(metadata)
  if (!meta) return null
  return meta.headshotUrl || meta.previewImageUrl || meta.fullBodyUrl || null
}
</script>

<template>
  <div class="h-[calc(100dvh-4rem)] flex overflow-hidden bg-default">
    <!-- LEFT: Chat Sidebar -->
    <aside
      class="hidden md:flex w-80 lg:w-96 border-r border-default/50 bg-elevated flex-col shrink-0"
    >
      <div
        class="h-14 border-b border-default/50 px-4 flex items-center justify-between shrink-0 glass z-10"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-bot" class="size-5 text-primary" />
          <span class="font-display font-semibold text-sm">
            {{ preset?.type === 'person' ? 'Character' : preset?.type || 'Preset' }} Assistant
          </span>
        </div>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-trash-2"
          size="xs"
          title="Clear chat history"
          @click="handleClearChat"
        />
      </div>

      <!-- Chat Messages -->
      <div ref="chatScrollContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
        <ChatMessages
          :messages="chatMessages"
          :is-chatting="isChatting"
          :generating-preview="generatingPreview"
          :headshot-url="headshotUrl"
          @use-prompt="handleUsePrompt"
          @save-prompt="handleSavePrompt"
        />
      </div>

      <!-- Chat Input -->
      <div class="px-3 py-3 border-t border-default/50 shrink-0">
        <UForm
          :state="{ input: chatInput }"
          class="flex items-end gap-2"
          @submit.prevent="sendChatMessage"
        >
          <UTextarea
            v-model="chatInput"
            placeholder="Ask Grok to help..."
            class="flex-1"
            size="sm"
            autoresize
            :rows="1"
            :maxrows="3"
            :disabled="isChatting"
            :ui="{ base: 'rounded-xl' }"
            @keydown="handleKeydown"
          />
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            icon="i-lucide-send"
            :loading="isChatting"
            :disabled="!chatInput.trim() || isChatting"
            class="rounded-xl shrink-0"
            size="sm"
          />
        </UForm>
      </div>

      <!-- Preset List (always open, searchable) -->
      <div class="border-t border-default/50 flex flex-col shrink-0 min-h-0 max-h-72">
        <div class="px-3 pt-2.5 pb-2 shrink-0">
          <UInput
            v-model="presetSearch"
            placeholder="Search presets..."
            icon="i-lucide-search"
            size="xs"
            class="w-full"
            :ui="{ base: 'rounded-lg' }"
          />
        </div>
        <div class="overflow-y-auto px-3 pb-3 space-y-3 flex-1">
          <div v-for="(items, type) in filteredGroupedElements" :key="type">
            <template v-if="items.length > 0">
              <h4 class="text-[10px] font-semibold text-dimmed uppercase tracking-wider mb-1 ml-1">
                {{ type }}s
              </h4>
              <UButton
                v-for="el in items"
                :key="el.id"
                variant="ghost"
                color="neutral"
                block
                size="xs"
                class="justify-start text-left h-auto py-1.5 group"
                :class="el.id === presetId ? 'bg-primary/10 ring-1 ring-primary/30' : ''"
                @click="el.id !== presetId && navigateTo(`/presets/${el.id}`)"
              >
                <div class="flex items-center gap-2 flex-1 overflow-hidden">
                  <img
                    v-if="presetThumb(el.metadata)"
                    :src="presetThumb(el.metadata)!"
                    :alt="el.name"
                    class="size-6 rounded-full object-cover shrink-0 ring-1 ring-default"
                  />
                  <UIcon v-else name="i-lucide-bookmark" class="size-4 text-dimmed shrink-0" />
                  <span
                    class="text-xs truncate"
                    :class="el.id === presetId ? 'font-semibold text-primary' : 'text-default'"
                    >{{ el.name }}</span
                  >
                </div>
              </UButton>
            </template>
          </div>
          <p
            v-if="Object.values(filteredGroupedElements).every((g) => g.length === 0)"
            class="text-xs text-dimmed text-center py-2"
          >
            No presets found
          </p>
        </div>
      </div>
    </aside>

    <!-- CENTER: Main Content -->
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-default/50 glass shrink-0">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UButton
              to="/presets"
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              size="sm"
              class="-ml-2"
            />
            <div>
              <h1 class="font-display font-semibold text-xl">
                {{ displayName }}
              </h1>
              <div class="flex items-center gap-2 mt-0.5">
                <UBadge v-if="preset" color="primary" variant="subtle" size="xs" class="capitalize">
                  {{ preset.type }}
                </UBadge>
                <span v-if="mergedState" class="text-xs text-muted tabular-nums">
                  {{ filledCount }}/{{ totalCount }} attributes filled
                </span>
                <span
                  v-if="saveStatus"
                  class="text-xs flex items-center gap-1 transition-opacity"
                  :class="saveStatus === 'saving' ? 'text-warning' : 'text-success'"
                >
                  <UIcon
                    :name="saveStatus === 'saving' ? 'i-lucide-loader-2' : 'i-lucide-check-circle'"
                    class="size-3"
                    :class="saveStatus === 'saving' ? 'animate-spin' : ''"
                  />
                  {{ saveStatus === 'saving' ? 'Saving...' : 'Saved' }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-bug"
              size="sm"
              class="hidden sm:inline-flex"
              title="Debug JSON"
              @click="isDebugModalOpen = true"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-library"
              size="sm"
              class="md:hidden"
              @click="isMobilePresetsOpen = true"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-eye"
              size="sm"
              :loading="generatingPreview"
              @click="handleGeneratePreview"
            >
              {{ headshotUrl || previewImageUrl ? 'Regenerate Preview' : 'Preview' }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loadStatus === 'pending'" class="flex-1 flex flex-col items-center gap-4 py-24">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        <p class="text-muted">Loading preset...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="flex-1 p-6">
        <UAlert
          color="error"
          icon="i-lucide-alert-triangle"
          title="Could not load preset"
          :description="loadError.message"
        />
      </div>

      <!-- Content -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <!-- Desktop: two-column (preview + attributes) -->
          <div class="flex flex-col lg:flex-row gap-6">
            <!-- Preview Column -->
            <div
              v-if="headshotUrl || previewImageUrl || generatingPreview"
              class="lg:w-44 shrink-0"
            >
              <h2
                class="text-xs font-semibold text-muted uppercase tracking-wider mb-3 hidden lg:block"
              >
                Preview
              </h2>

              <!-- Mobile: small inline preview -->
              <div v-if="headshotUrl || previewImageUrl" class="lg:hidden mb-4">
                <div
                  class="size-16 rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in"
                >
                  <NuxtImg
                    :src="(headshotUrl || previewImageUrl)!"
                    alt="Preview"
                    class="size-full object-contain"
                    loading="lazy"
                    @click="openPreviewInViewer"
                  />
                </div>
              </div>

              <!-- Desktop: preview image -->
              <div v-if="headshotUrl || previewImageUrl" class="hidden lg:block">
                <div
                  class="rounded-xl overflow-hidden ring-1 ring-primary/20 cursor-zoom-in shadow-card"
                >
                  <NuxtImg
                    :src="(headshotUrl || previewImageUrl)!"
                    alt="Preview"
                    class="size-full object-contain"
                    loading="lazy"
                    @click="openPreviewInViewer"
                  />
                </div>
              </div>

              <!-- Generating -->
              <div
                v-if="generatingPreview"
                class="flex items-center gap-2 p-3 rounded-lg bg-elevated border border-default mt-3"
              >
                <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-primary" />
                <span class="text-xs text-muted">Generating...</span>
              </div>

              <!-- Generate Image Button -->
              <UButton
                v-if="headshotUrl || previewImageUrl"
                block
                color="primary"
                icon="i-lucide-image"
                class="mt-4 shadow-elevated"
                :loading="isGeneratingImage"
                @click="handleGenerateImage"
              >
                Generate
                {{
                  preset?.type === 'person'
                    ? 'Person'
                    : preset?.type
                      ? preset.type.charAt(0).toUpperCase() + preset.type.slice(1)
                      : 'Image'
                }}
              </UButton>
            </div>

            <!-- Attributes Column -->
            <div v-if="mergedState" class="flex-1 min-w-0">
              <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Attributes
              </h2>
              <PresetAttributeGrid
                :state="mergedState"
                :overrides="editableOverrides"
                :columns="3"
                @update="updateAttribute"
              />
            </div>

            <!-- Raw Content fallback -->
            <div v-else-if="preset?.content" class="flex-1 min-w-0">
              <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Content
              </h2>
              <div
                class="p-4 rounded-xl bg-elevated border border-default text-sm whitespace-pre-wrap"
              >
                {{ preset.content }}
              </div>
            </div>
          </div>

          <!-- Separator before gallery section -->
          <div v-if="presetGenerations.length > 0" class="my-10">
            <USeparator
              label="Recent Generations"
              class="mb-6 font-display font-medium text-sm text-muted"
            />
          </div>

          <!-- Generations Carousel -->
          <div v-if="presetGenerations.length > 0" class="pb-8">
            <UCarousel
              v-slot="{ item }"
              :items="presetGenerations"
              :ui="{
                viewport: 'overflow-visible',
                item: 'flex basis-auto',
                container: 'gap-4',
              }"
              arrows
              class="w-full relative"
            >
              <div
                class="relative group rounded-xl overflow-hidden ring-1 ring-default shadow-card bg-elevated my-2 hover:ring-primary/50 transition-all duration-300 cursor-pointer"
                @click="openPresetViewer(item)"
              >
                <div v-if="item.mediaUrl" class="block h-48 w-auto">
                  <NuxtImg
                    v-if="item.type === 'image'"
                    :src="item.mediaUrl"
                    :alt="item.prompt"
                    class="h-full w-auto object-cover"
                    loading="lazy"
                  />
                  <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
                  <video
                    v-else
                    :src="item.mediaUrl"
                    preload="metadata"
                    class="h-full w-auto object-cover"
                  />
                </div>
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                ></div>
              </div>
            </UCarousel>
          </div>
        </div>
      </div>

      <!-- Mobile Chat Bar (shown below content on mobile) -->
      <div class="md:hidden px-3 py-3 border-t border-default/50 shrink-0 pb-safe">
        <UForm
          :state="{ input: chatInput }"
          class="flex items-end gap-2"
          @submit.prevent="sendChatMessage"
        >
          <UTextarea
            v-model="chatInput"
            placeholder="Ask Grok to help..."
            class="flex-1"
            size="sm"
            autoresize
            :rows="1"
            :maxrows="3"
            :disabled="isChatting"
            :ui="{ base: 'rounded-xl' }"
            @keydown="handleKeydown"
          />
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            icon="i-lucide-send"
            :loading="isChatting"
            :disabled="!chatInput.trim() || isChatting"
            class="rounded-xl shrink-0"
            size="sm"
          />
        </UForm>
      </div>
    </div>

    <!-- Mobile Presets Slideover -->
    <USlideover v-model:open="isMobilePresetsOpen" side="right">
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
              @click="isMobilePresetsOpen = false"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <div v-for="(items, type) in filteredGroupedElements" :key="type">
              <template v-if="items.length > 0">
                <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2 ml-1">
                  {{ type }}s
                </h3>
                <div class="space-y-1">
                  <UButton
                    v-for="el in items"
                    :key="el.id"
                    variant="soft"
                    color="neutral"
                    block
                    class="justify-start text-left h-auto py-2.5"
                    :class="el.id === presetId ? 'ring-1 ring-primary/30 bg-primary/10' : ''"
                    @click="
                      el.id !== presetId &&
                      ((isMobilePresetsOpen = false), navigateTo(`/presets/${el.id}`))
                    "
                  >
                    <div class="flex items-center gap-2 flex-1 overflow-hidden">
                      <img
                        v-if="parseMeta(el.metadata)?.headshotUrl"
                        :src="parseMeta(el.metadata)!.headshotUrl"
                        :alt="el.name"
                        class="size-8 rounded-full object-cover shrink-0 ring-1 ring-default"
                      />
                      <div class="flex flex-col flex-1 overflow-hidden">
                        <span
                          class="text-sm font-medium truncate"
                          :class="el.id === presetId ? 'text-primary' : 'text-default'"
                          >{{ el.name }}</span
                        >
                        <span class="text-xs text-dimmed truncate">{{ el.content }}</span>
                      </div>
                    </div>
                  </UButton>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
    <UModal v-model:open="isDebugModalOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold font-display">Debug State</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="-mr-2"
              @click="isDebugModalOpen = false"
            />
          </div>
          <div class="space-y-4 overflow-y-auto max-h-[70vh]">
            <div>
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Preset Data
              </h4>
              <pre
                class="text-xs bg-elevated p-3 rounded-xl border border-default overflow-x-auto"
                >{{ JSON.stringify(preset, null, 2) }}</pre
              >
            </div>
            <div>
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Merged State
              </h4>
              <pre
                class="text-xs bg-elevated p-3 rounded-xl border border-default overflow-x-auto"
                >{{ JSON.stringify(mergedState, null, 2) }}</pre
              >
            </div>
            <div>
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Editable Overrides
              </h4>
              <pre
                class="text-xs bg-elevated p-3 rounded-xl border border-default overflow-x-auto"
                >{{ JSON.stringify(editableOverrides, null, 2) }}</pre
              >
            </div>
            <div>
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Chat Context
              </h4>
              <pre
                class="text-xs bg-elevated p-3 rounded-xl border border-default overflow-x-auto"
                >{{ JSON.stringify(currentBuilderState, null, 2) }}</pre
              >
            </div>
          </div>
        </div>
      </template>
    </UModal>
    <GalleryViewer />
  </div>
</template>
