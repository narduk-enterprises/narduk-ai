<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Prompts — Narduk AI',
  description: 'Compose, refine, and save AI generation prompts using Grok.',
})
useWebPageSchema({
  name: 'Prompts — Narduk AI',
  description: 'Compose, refine, and save AI generation prompts.',
})

const route = useRoute()

const { elements, groupedByType, ensureLoaded: ensureElementsLoaded } = usePromptElements()
const {
  prompts: savedPrompts,
  loading: libraryLoading,
  fetchPrompts,
  deletePrompt,
  savePrompt,
} = usePromptLibrary()
const savingPrompt = ref(false)
const { prompts: systemPrompts } = useSystemPrompts()
const { allTagsList: allModifiersList } = usePromptTags()

// ── View ───────────────────────────────────────────────────────────
type MainView = 'compose' | 'library'
const mainView = ref<MainView>((route.query.view as MainView) || 'compose')

// Media type from query param (passed from generate page)
const mediaType = ref<'image' | 'video'>((route.query.mediaType as 'image' | 'video') || 'image')

// ── Preset Selection ───────────────────────────────────────────────
const searchQuery = ref('')

const composeSelection = reactive<Record<string, string | null>>({
  person: null,
  scene: null,
  framing: null,
  action: null,
  style: null,
})

const composeSelectionCount = computed(() => Object.values(composeSelection).filter(Boolean).length)

const composeTypeIcons: Record<string, string> = {
  person: 'i-lucide-user',
  scene: 'i-lucide-image',
  framing: 'i-lucide-camera',
  action: 'i-lucide-activity',
  style: 'i-lucide-palette',
}

const composeCategories: Record<string, string> = {
  person: 'Person / Character',
  scene: 'Scene / Environment',
  framing: 'Framing / Camera',
  action: 'Action / Pose',
  style: 'Style / Aesthetics',
}

const filteredGroupedByType = computed(() => {
  if (!searchQuery.value.trim()) return groupedByType.value

  const q = searchQuery.value.toLowerCase()
  const filtered: Record<string, typeof elements.value> = {}

  for (const key of Object.keys(groupedByType.value)) {
    const list = groupedByType.value[key] || []
    const matches = list.filter(
      (el) => el.name.toLowerCase().includes(q) || el.content.toLowerCase().includes(q),
    )
    if (matches.length > 0) {
      filtered[key] = matches
    }
  }
  return filtered
})

function isElementSelected(el: { type: string; name: string }) {
  return composeSelection[el.type] === el.name
}

function handleComposeToggle(el: { type: string; name: string }) {
  composeSelection[el.type] = composeSelection[el.type] === el.name ? null : el.name
}

function getPreviewImageUrl(el: { metadata?: string | null }): string | null {
  if (!el.metadata) return null
  try {
    const meta = JSON.parse(el.metadata) as { headshotUrl?: string; fullBodyUrl?: string }
    return meta.headshotUrl || meta.fullBodyUrl || null
  } catch {
    return null
  }
}

// ── Chat / Refine ──────────────────────────────────────────────────
const chatMessages = ref<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([])
const chatLog = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const currentPromptDraft = ref<string>('')
const chatInput = ref('')
const chatting = ref(false)
const savedPromptId = ref<string | null>(null)
const saveTitle = ref('')
const step = ref<'presets' | 'refine'>('presets')

async function composeDraft() {
  if (composeSelectionCount.value === 0) return

  step.value = 'refine'
  chatting.value = true
  currentPromptDraft.value = ''
  chatLog.value = []
  savedPromptId.value = null

  const parts = Object.entries(composeSelection)
    .filter(([_, val]) => val)
    .map(([key, name]) => {
      const el = elements.value.find((e) => e.type === key && e.name === name)
      return `${key}: ${el?.content || name}`
    })
    .join('\n')

  const isVideo = mediaType.value === 'video'
  const sysContent = isVideo ? systemPrompts.value.compose_video : systemPrompts.value.compose_image
  const modifiersContext = allModifiersList.value.length
    ? `\n\nYou can also suggest enhancements using Quick Modifiers if applicable. When suggesting modifications, emit attribute-value pairs in your <builder_state> JSON response using attribute keys (e.g. {"hair_color": "blonde", "lighting": "golden hour"}). Available modifiers:\n` +
      allModifiersList.value
        .map((m) => `- ${m.attributeKey}: "${m.label}" → "${m.snippet}"`)
        .join('\n')
    : ''

  chatMessages.value = [
    { role: 'system' as const, content: (sysContent || '') + modifiersContext },
    {
      role: 'user' as const,
      content: `Here are my starting components:\n\n${parts}\n\nPlease generate the first draft.`,
    },
  ]

  chatLog.value.push({ role: 'assistant', text: '' })
  const assistantIndex = chatLog.value.length - 1

  try {
    await usePromptBuilderStream(chatMessages.value, {
      onMessage: (text) => {
        chatLog.value[assistantIndex]!.text = text
      },
      onPrompt: (p) => {
        currentPromptDraft.value = p
      },
      onTitle: (title) => {
        if (!saveTitle.value) saveTitle.value = title
      },
    })
    if (!chatLog.value[assistantIndex]!.text) chatLog.value[assistantIndex]!.text = 'Draft created.'
    chatMessages.value.push({ role: 'assistant', content: currentPromptDraft.value })
  } catch (e) {
    console.error('Failed to generate draft', e)
    chatLog.value[assistantIndex]!.text = 'Sorry, I encountered an error generating the draft.'
  } finally {
    chatting.value = false
  }
}

async function sendChatMessage() {
  if (!chatInput.value.trim() || chatting.value) return

  const text = chatInput.value.trim()
  chatInput.value = ''
  chatLog.value.push({ role: 'user', text })
  chatting.value = true

  const stateContext = currentPromptDraft.value
    ? `\n\nCURRENT PROMPT DRAFT:\n${currentPromptDraft.value}`
    : ''
  chatMessages.value.push({ role: 'user' as const, content: `${text}${stateContext}` })

  chatLog.value.push({ role: 'assistant', text: '' })
  const assistantIndex = chatLog.value.length - 1

  try {
    await usePromptBuilderStream(chatMessages.value, {
      onMessage: (t) => {
        chatLog.value[assistantIndex]!.text = t
      },
      onPrompt: (p) => {
        currentPromptDraft.value = p
      },
      onTitle: (title) => {
        if (!saveTitle.value) saveTitle.value = title
      },
    })
    if (!chatLog.value[assistantIndex]!.text)
      chatLog.value[assistantIndex]!.text = 'Updated the prompt.'
    chatMessages.value.push({ role: 'assistant', content: currentPromptDraft.value })
  } catch (e) {
    console.error('Chat failed', e)
    chatLog.value[assistantIndex]!.text = 'Error refining prompt.'
    chatMessages.value.pop()
  } finally {
    chatting.value = false
  }
}

function handleChatKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessage()
  }
}

async function handleSaveToLibrary() {
  if (!currentPromptDraft.value || savingPrompt.value) return
  let title = saveTitle.value.trim()
  if (!title) {
    const componentNames = ['person', 'scene', 'clothing', 'framing', 'action', 'style']
      .filter((t) => composeSelection[t])
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    title = componentNames.length > 0 ? `Composed: ${componentNames.join(' + ')}` : 'New Prompt'
  }

  savingPrompt.value = true
  try {
    const initialPresetsJson = JSON.stringify(composeSelection)
    const chatHistoryJson = JSON.stringify(chatLog.value)
    const saved = await savePrompt(
      title,
      currentPromptDraft.value,
      initialPresetsJson,
      chatHistoryJson,
    )
    savedPromptId.value = saved.id
  } catch (e) {
    console.error('Failed to save', e)
  } finally {
    savingPrompt.value = false
  }
}

function handleUsePrompt(promptText?: string) {
  const text = promptText ?? currentPromptDraft.value
  if (!text) return
  navigateTo(`/generate?prompt=${encodeURIComponent(text)}`)
}

function resetCompose() {
  step.value = 'presets'
  for (const key of Object.keys(composeSelection)) {
    composeSelection[key] = null
  }
  chatMessages.value = []
  chatLog.value = []
  currentPromptDraft.value = ''
  chatInput.value = ''
  savedPromptId.value = null
  saveTitle.value = ''
}

// ── Library ───────────────────────────────────────────────────────
const librarySearch = ref('')

const filteredSavedPrompts = computed(() => {
  if (!librarySearch.value.trim()) return savedPrompts.value
  const q = librarySearch.value.toLowerCase()
  return savedPrompts.value.filter(
    (p) => p.title?.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q),
  )
})

function extractPresets(initialPresets?: string | null): Record<string, string> {
  if (!initialPresets) return {}
  try {
    return JSON.parse(initialPresets)
  } catch {
    return {}
  }
}

function loadFromLibrary(p: { prompt: string; initialPresets?: string | null }) {
  // Pre-fill compose selection from saved presets
  const presets = extractPresets(p.initialPresets)
  for (const key of Object.keys(composeSelection)) {
    composeSelection[key] = presets[key] ?? null
  }
  currentPromptDraft.value = p.prompt
  step.value = 'refine'
  mainView.value = 'compose'
}

async function handleDeletePrompt(id: string) {
  if (confirm('Are you sure you want to delete this prompt?')) {
    await deletePrompt(id)
  }
}

function switchToLibrary() {
  mainView.value = 'library'
  fetchPrompts()
}

// ── Chat scroll ───────────────────────────────────────────────────
const chatContainer = ref<HTMLElement | null>(null)
/* vue-official allow-deep-watch */
watch(
  chatLog,
  () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    })
  },
  { deep: true },
)

// ── Lifecycle ─────────────────────────────────────────────────────
onMounted(() => {
  ensureElementsLoaded()
  if (savedPrompts.value.length === 0) fetchPrompts()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-safe">
    <!-- Page Header -->
    <div class="mb-8 flex items-end justify-between flex-wrap gap-4">
      <div>
        <h1 class="font-display text-3xl sm:text-4xl font-bold mb-2">Prompts</h1>
        <p class="text-muted">Build, refine, and save generation prompts with Grok</p>
      </div>
      <!-- Top-level tabs -->
      <div class="flex gap-2">
        <UButton
          :variant="mainView === 'compose' ? 'solid' : 'outline'"
          :color="mainView === 'compose' ? 'primary' : 'neutral'"
          icon="i-lucide-wand-2"
          size="sm"
          class="rounded-full"
          @click="mainView = 'compose'"
        >
          Compose
        </UButton>
        <UButton
          :variant="mainView === 'library' ? 'solid' : 'outline'"
          :color="mainView === 'library' ? 'primary' : 'neutral'"
          icon="i-lucide-library"
          size="sm"
          class="rounded-full"
          @click="switchToLibrary"
        >
          Library
        </UButton>
        <!-- Media type toggle -->
        <USeparator orientation="vertical" class="h-8 mx-1" />
        <UButton
          :variant="mediaType === 'image' ? 'solid' : 'outline'"
          :color="mediaType === 'image' ? 'neutral' : 'neutral'"
          icon="i-lucide-image"
          size="sm"
          class="rounded-full"
          :class="mediaType === 'image' ? 'ring-1 ring-primary/30' : ''"
          @click="mediaType = 'image'"
        >
          Image
        </UButton>
        <UButton
          :variant="mediaType === 'video' ? 'solid' : 'outline'"
          :color="mediaType === 'video' ? 'neutral' : 'neutral'"
          icon="i-lucide-video"
          size="sm"
          class="rounded-full"
          :class="mediaType === 'video' ? 'ring-1 ring-primary/30' : ''"
          @click="mediaType = 'video'"
        >
          Video
        </UButton>
      </div>
    </div>

    <!-- ── COMPOSE VIEW ──────────────────────────────────────────────── -->
    <div v-if="mainView === 'compose'" class="space-y-6">
      <!-- Step indicator -->
      <div class="flex items-center gap-3">
        <UButton
          :variant="step === 'presets' ? 'solid' : 'soft'"
          :color="step === 'presets' ? 'primary' : 'neutral'"
          size="sm"
          icon="i-lucide-layers"
          class="rounded-full"
          @click="step = 'presets'"
        >
          1. Pick Presets
        </UButton>
        <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
        <UButton
          :variant="step === 'refine' ? 'solid' : 'soft'"
          :color="step === 'refine' ? 'primary' : 'neutral'"
          size="sm"
          icon="i-lucide-message-square"
          :disabled="composeSelectionCount === 0 && !currentPromptDraft"
          class="rounded-full"
          @click="step = 'refine'"
        >
          2. Refine with Grok
        </UButton>
      </div>

      <!-- ── STEP 1: PRESETS ──────────────────────────────────────────── -->
      <div v-if="step === 'presets'" class="space-y-6">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search presets..."
          class="w-full max-w-md"
        />

        <div
          v-for="(typeLabel, typeKey) in composeCategories"
          :key="typeKey"
          class="space-y-3"
          v-show="filteredGroupedByType[typeKey]?.length"
        >
          <h3
            class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"
          >
            <UIcon :name="composeTypeIcons[typeKey] || 'i-lucide-folder'" class="size-3.5" />
            {{ typeLabel }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="el in filteredGroupedByType[typeKey]"
              :key="el.id"
              :variant="isElementSelected(el) ? 'solid' : 'outline'"
              :color="isElementSelected(el) ? 'primary' : 'neutral'"
              size="sm"
              class="rounded-full transition-all duration-200"
              :class="isElementSelected(el) ? 'shadow-md shadow-primary/20' : ''"
              @click="handleComposeToggle(el)"
            >
              <template #leading>
                <NuxtImg
                  v-if="getPreviewImageUrl(el)"
                  :src="getPreviewImageUrl(el)!"
                  class="size-5 rounded-full object-cover ring-1 ring-default/20 -ml-0.5"
                  width="20"
                  height="20"
                  loading="lazy"
                />
              </template>
              {{ el.name }}
            </UButton>
          </div>
        </div>

        <div
          v-if="Object.keys(filteredGroupedByType).length === 0"
          class="text-center py-12 text-sm text-muted"
        >
          No presets match your search.
        </div>

        <!-- Footer actions -->
        <div class="flex items-center justify-between border-t border-default/10 pt-4">
          <span class="text-sm text-muted">{{ composeSelectionCount }} selected</span>
          <div class="flex gap-3">
            <UButton color="neutral" variant="ghost" @click="resetCompose"> Reset </UButton>
            <UButton
              color="primary"
              icon="i-lucide-sparkles"
              :disabled="composeSelectionCount === 0"
              :loading="chatting"
              @click="composeDraft"
            >
              Compose Draft
            </UButton>
          </div>
        </div>
      </div>

      <!-- ── STEP 2: REFINE ───────────────────────────────────────────── -->
      <div v-else-if="step === 'refine'" class="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[60vh]">
        <!-- Left: Current Prompt Draft -->
        <div class="glass-card p-6 flex flex-col space-y-4">
          <h3
            class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2"
          >
            <UIcon name="i-lucide-file-text" class="size-4" />
            Current Prompt
          </h3>

          <div
            v-if="currentPromptDraft"
            class="bg-default rounded-xl border border-primary/20 p-4 shadow-sm relative group flex-1"
          >
            <div
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <CopyButton :text="currentPromptDraft" size="xs" />
            </div>
            <p class="text-sm leading-relaxed text-default whitespace-pre-wrap pr-6">
              {{ currentPromptDraft }}
            </p>
          </div>
          <div v-else class="flex items-center justify-center flex-1 h-32">
            <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
          </div>

          <div class="mt-auto space-y-3 pt-4">
            <template v-if="savedPromptId">
              <UAlert
                color="success"
                variant="subtle"
                icon="i-lucide-check-circle"
                title="Saved to Library"
              />
            </template>
            <template v-else>
              <div class="flex gap-2">
                <UInput
                  v-model="saveTitle"
                  placeholder="Optional title..."
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  size="sm"
                  icon="i-lucide-save"
                  color="neutral"
                  variant="outline"
                  :loading="savingPrompt"
                  :disabled="!currentPromptDraft || chatting"
                  @click="handleSaveToLibrary"
                >
                  Save
                </UButton>
              </div>
            </template>

            <UButton
              block
              icon="i-lucide-send"
              color="primary"
              size="lg"
              :disabled="!currentPromptDraft"
              @click="handleUsePrompt()"
            >
              Use in Generate
            </UButton>
          </div>
        </div>

        <!-- Right: Grok Chat -->
        <div class="glass-card flex flex-col h-full overflow-hidden min-h-[400px]">
          <div
            class="p-4 border-b border-default/10 bg-muted/10 shrink-0 flex items-center justify-between"
          >
            <span
              class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"
            >
              <UIcon name="i-lucide-message-square" class="size-3.5" />
              Refine with Grok
            </span>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-arrow-left"
              @click="step = 'presets'"
            >
              Back
            </UButton>
          </div>

          <!-- Messages -->
          <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
            <div
              v-for="(msg, i) in chatLog"
              :key="i"
              class="flex flex-col max-w-[90%]"
              :class="msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'"
            >
              <div
                class="text-[10px] text-muted mb-1 ml-1 flex items-center gap-1 uppercase tracking-wider font-semibold"
              >
                <UIcon
                  :name="msg.role === 'user' ? 'i-lucide-user' : 'i-lucide-bot'"
                  class="size-3"
                />
                {{ msg.role === 'user' ? 'You' : 'Grok' }}
              </div>
              <div
                class="rounded-2xl px-3.5 py-2 text-sm"
                :class="
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted/50 border border-default/50 rounded-tl-sm'
                "
              >
                {{ msg.text }}
              </div>
            </div>
            <div
              v-if="chatting && chatLog[chatLog.length - 1]?.role !== 'assistant'"
              class="mr-auto items-start flex flex-col max-w-[90%]"
            >
              <div
                class="rounded-2xl px-4 py-3 bg-muted/50 border border-default/50 rounded-tl-sm flex items-center gap-1.5 h-10"
              >
                <div
                  class="size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style="animation-delay: 0ms"
                />
                <div
                  class="size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style="animation-delay: 150ms"
                />
                <div
                  class="size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style="animation-delay: 300ms"
                />
              </div>
            </div>

            <div
              v-if="chatLog.length === 0 && !chatting"
              class="text-center text-muted text-sm py-8"
            >
              Select presets and click "Compose Draft" to start, or type a message below to get
              Grok's help.
            </div>
          </div>

          <!-- Chat input -->
          <div class="p-3 bg-default border-t border-default/10 shrink-0">
            <div class="relative">
              <UTextarea
                v-model="chatInput"
                placeholder="Ask Grok to change something..."
                :rows="1"
                :maxrows="4"
                autoresize
                class="w-full pr-10"
                :disabled="chatting"
                @keydown="handleChatKeydown"
              />
              <UButton
                color="primary"
                variant="ghost"
                icon="i-lucide-arrow-up"
                size="sm"
                class="absolute right-1 bottom-1 rounded-lg hover:bg-primary/10"
                :loading="chatting"
                :disabled="!chatInput.trim() || chatting"
                @click="sendChatMessage"
              />
            </div>
            <div class="text-center mt-1">
              <span class="text-[10px] text-dimmed">Shift+Enter for newline</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── LIBRARY VIEW ──────────────────────────────────────────────── -->
    <div v-else-if="mainView === 'library'" class="space-y-6">
      <div v-if="libraryLoading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      </div>

      <div
        v-else-if="savedPrompts.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <UIcon name="i-lucide-bookmark" class="size-12 text-muted mb-4 opacity-50" />
        <h3 class="text-lg font-medium text-default mb-2">No Saved Prompts</h3>
        <p class="text-sm text-dimmed max-w-sm">
          Compose and refine prompts here, then save them to your library for quick reuse.
        </p>
        <UButton color="primary" variant="outline" class="mt-6" @click="mainView = 'compose'">
          Start Composing
        </UButton>
      </div>

      <template v-else>
        <UInput
          v-model="librarySearch"
          icon="i-lucide-search"
          placeholder="Search saved prompts..."
          class="w-full max-w-md"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="p in filteredSavedPrompts"
            :key="p.id"
            class="glass-card p-5 flex flex-col group transition-all duration-200 hover:shadow-md hover:border-primary/30"
          >
            <div class="flex items-start justify-between mb-3">
              <h4 class="font-semibold text-sm line-clamp-1 flex-1 pr-2" :title="p.title">
                {{ p.title || 'Untitled Prompt' }}
              </h4>
              <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-wand-2"
                  class="-my-1"
                  title="Open in Composer"
                  @click="loadFromLibrary(p)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  class="-my-1 -mr-1"
                  @click="handleDeletePrompt(p.id)"
                />
              </div>
            </div>

            <div class="flex-1 rounded-lg bg-default/50 p-3 text-muted relative mb-4">
              <ExpandableText
                :text="p.prompt"
                :collapsed-lines="4"
                text-class="font-mono text-xs"
                button-class="text-xs"
              />
            </div>

            <div class="mt-auto flex items-center justify-between pt-3 border-t border-default/10">
              <span class="text-[10px] text-dimmed uppercase tracking-wider font-semibold">
                {{ new Date(p.createdAt).toLocaleDateString() }}
              </span>
              <UButton
                size="sm"
                color="primary"
                icon="i-lucide-send"
                @click="handleUsePrompt(p.prompt)"
              >
                Use
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
