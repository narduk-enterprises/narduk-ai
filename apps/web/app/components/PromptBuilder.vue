<script setup lang="ts">
import type { PresetMetadata } from '../composables/usePromptElements'
import { usePromptElements } from '../composables/usePromptElements'
import { usePromptLibrary } from '../composables/usePromptLibrary'

const isModalOpen = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    mediaType?: 'image' | 'video'
  }>(),
  { mediaType: 'image' },
)

const emit = defineEmits<{
  (e: 'use-prompt', prompt: string, presets: Record<string, string>, promptId?: string): void
}>()

const { elements, groupedByType, fetchElements } = usePromptElements()
const { savePrompt, loading: saving } = usePromptLibrary()

const step = ref<'presets' | 'refine'>('presets')
const searchQuery = ref('')

// Preset Selection State
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

function isElementSelected(el: { type: string; content: string }) {
  return composeSelection[el.type] === el.content
}

function handleComposeToggle(el: { type: string; content: string }) {
  composeSelection[el.type] = composeSelection[el.type] === el.content ? null : el.content
}

function getPreviewImageUrl(el: { metadata?: string | null }): string | null {
  if (!el.metadata) return null
  try {
    const meta = JSON.parse(el.metadata) as PresetMetadata
    return meta.headshotUrl || meta.fullBodyUrl || null
  } catch {
    return null
  }
}

// Chat / Refine State
const chatMessages = ref<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([])
const chatLog = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const currentPromptDraft = ref<string>('')
const chatInput = ref('')
const chatting = ref(false)
const savedPromptId = ref<string | null>(null)
const saveTitle = ref('')

async function composeDraft() {
  if (composeSelectionCount.value === 0) return

  step.value = 'refine'
  chatting.value = true
  currentPromptDraft.value = ''
  chatLog.value = []
  savedPromptId.value = null

  const parts = Object.entries(composeSelection)
    .filter(([_, val]) => val)
    .map(([key, val]) => `${key}: ${val}`)
    .join('\n')

  const isVideo = props.mediaType === 'video'
  const systemMsg = {
    role: 'system' as const,
    content: isVideo
      ? `You are a prompt engineering expert. The user is selecting components to generate a VIDEO prompt for Grok Imagine.
Compose them into a single, cohesive, highly-detailed video generation prompt. Emphasize motion, temporal progression, camera movement, pacing, and dynamic action rather than static composition.
CRITICAL: The prompt MUST produce results that look like real footage shot on a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER create prompts that would produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Always include photorealism anchors such as "photorealistic", "shot on [real camera]", "natural lighting", "film grain", or "35mm film".
Whenever the user talks to you, refine the prompt based on their request.
Return JSON ONLY, matching exactly: { "message": "friendly chat reply to the user explaining what you did", "prompt": "the updated full generation prompt string", "suggested_title": "A short, catchy title for this prompt" }.
Make the prompt vivid, specific, and ready to use for video generation. Do not include category prefixes in the final prompt.`
      : `You are a prompt engineering expert. The user is selecting components to generate an image/video prompt.
Compose them into a single, cohesive, highly-detailed generation prompt.
CRITICAL: The prompt MUST produce results that look like a real photograph taken with a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER create prompts that would produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Always include photorealism anchors such as "photorealistic", "shot on [real camera]", "natural lighting", "film grain", or "35mm film".
Whenever the user talks to you, refine the prompt based on their request.
Return JSON ONLY, matching exactly: { "message": "friendly chat reply to the user explaining what you did", "prompt": "the updated full generation prompt string", "suggested_title": "A short, catchy title for this prompt" }.
Make the prompt vivid, specific, and ready to use for image generation. Do not include category prefixes in the final prompt.`,
  }

  const userMsg = {
    role: 'user' as const,
    content: `Here are my starting components:\n\n${parts}\n\nPlease generate the first draft.`,
  }

  chatMessages.value = [systemMsg, userMsg]

  try {
    // eslint-disable-next-line narduk/no-raw-fetch, narduk/no-fetch-in-component -- This is a client-side user action, not SSR data fetching
    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: { chatMode: 'general', messages: chatMessages.value },
    })

    const parsed = JSON.parse(res.content)
    currentPromptDraft.value = parsed.prompt || ''
    if (parsed.suggested_title && !saveTitle.value) {
      saveTitle.value = parsed.suggested_title
    }
    chatLog.value.push({ role: 'assistant', text: parsed.message || 'Draft created.' })

    // Store assistant's original raw JSON reply in the internal message array for context
    chatMessages.value.push({ role: 'assistant', content: res.content })
  } catch (e) {
    console.error('Failed to generate draft', e)
    chatLog.value.push({
      role: 'assistant',
      text: 'Sorry, I encountered an error generating the draft.',
    })
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

  const userMsg = { role: 'user' as const, content: text }
  chatMessages.value.push(userMsg)

  try {
    // eslint-disable-next-line narduk/no-raw-fetch, narduk/no-fetch-in-component -- This is a client-side user action, not SSR data fetching
    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: { chatMode: 'general', messages: chatMessages.value },
    })

    const parsed = JSON.parse(res.content)
    if (parsed.prompt) currentPromptDraft.value = parsed.prompt
    if (parsed.suggested_title && !saveTitle.value) {
      saveTitle.value = parsed.suggested_title
    }
    chatLog.value.push({ role: 'assistant', text: parsed.message || 'Updated the prompt.' })
    chatMessages.value.push({ role: 'assistant', content: res.content })
  } catch (e) {
    console.error('Chat failed', e)
    chatLog.value.push({ role: 'assistant', text: 'Error refining prompt.' })
    // Pop the failed user message so they can try again if they want
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
  if (!currentPromptDraft.value || saving.value) return
  let title = saveTitle.value.trim()
  if (!title) {
    const componentNames = ['person', 'scene', 'framing', 'action', 'style']
      .filter((t) => composeSelection[t])
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    title = componentNames.length > 0 ? `Composed: ${componentNames.join(' + ')}` : 'New Prompt'
  }

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
  }
}

function handleUsePrompt() {
  const cleanSelection: Record<string, string> = {}
  for (const [key, val] of Object.entries(composeSelection)) {
    if (val !== null) cleanSelection[key] = val
  }
  emit('use-prompt', currentPromptDraft.value, cleanSelection, savedPromptId.value || undefined)
  isModalOpen.value = false
  setTimeout(resetState, 300) // reset after animation
}

function resetState() {
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

// Watchers and lifecycles
watch(isModalOpen, (open) => {
  if (open) {
    if (elements.value.length === 0) {
      fetchElements()
    }
  } else {
    // Optionally preserve state on close, or reset it.
    // For now we preserve state so the user doesn't lose progress if they accidentally click out.
  }
})

// Scroll chat to bottom
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
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    :ui="{
      content: 'sm:max-w-5xl flex flex-col h-[85vh] sm:h-[75vh] overflow-hidden bg-default',
      header: 'shrink-0',
      body: 'flex-1 overflow-hidden p-0',
      footer: 'shrink-0',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-display font-semibold text-lg flex items-center gap-2">
          <UIcon name="i-lucide-wand-2" class="size-5 text-primary" />
          Prompt Builder
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="isModalOpen = false"
        />
      </div>
    </template>

    <template #body>
      <!-- STEP 1: PRESETS -->
      <div v-if="step === 'presets'" class="h-full flex flex-col p-6 overflow-y-auto space-y-6">
        <div class="space-y-4">
          <div class="space-y-1">
            <h4 class="text-sm font-medium text-default">Step 1: Select Starting Elements</h4>
            <p class="text-sm text-muted">
              Pick at least one element to use as a starting point. Grok will help you tie them
              together.
            </p>
          </div>
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search elements..."
            class="w-full"
            size="sm"
          />
        </div>

        <div
          v-for="(typeLabel, typeKey) in composeCategories"
          :key="typeKey"
          class="space-y-3"
          v-show="filteredGroupedByType[typeKey]?.length"
        >
          <h5
            class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"
          >
            <UIcon :name="composeTypeIcons[typeKey] || 'i-lucide-folder'" class="size-3.5" />
            {{ typeLabel }}
          </h5>
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
          class="text-center py-6 text-sm text-muted"
        >
          No elements match your search.
        </div>
      </div>

      <!-- STEP 2: REFINE / CHAT -->
      <div
        v-else-if="step === 'refine'"
        class="h-full flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-default/10"
      >
        <!-- Current Draft Panel -->
        <div class="md:w-1/2 flex flex-col bg-muted/30 p-5 shrink-0 overflow-y-auto">
          <h4
            class="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-2"
          >
            <UIcon name="i-lucide-file-text" class="size-4" />
            Current Prompt
          </h4>

          <div
            v-if="currentPromptDraft"
            class="bg-default rounded-xl border border-primary/20 p-4 shadow-sm relative group mb-4"
          >
            <p class="text-sm leading-relaxed text-default whitespace-pre-wrap">
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
              <div class="flex gap-2 relative">
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
                  :loading="saving"
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
              @click="handleUsePrompt"
            >
              Use Prompt
            </UButton>
          </div>
        </div>

        <!-- Chat Panel -->
        <div class="md:w-1/2 flex flex-col h-full bg-default relative">
          <div
            class="p-3 border-b border-default/10 bg-muted/10 shrink-0 flex items-center justify-between"
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

          <!-- Chat Messages -->
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
                class="text-[10px] text-muted mb-1 ml-1 flex items-center gap-1 uppercase tracking-wider font-semibold"
              >
                <UIcon name="i-lucide-bot" class="size-3" />
                Grok
              </div>
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
          </div>

          <!-- Chat Input -->
          <div class="p-3 bg-default border-t border-default/10 shrink-0">
            <div class="relative">
              <UTextarea
                v-model="chatInput"
                placeholder="Ask grok to change something..."
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
    </template>

    <template #footer v-if="step === 'presets'">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted"> {{ composeSelectionCount }} selected </span>
        <div class="flex gap-3">
          <UButton color="neutral" variant="ghost" @click="resetState"> Reset </UButton>
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
    </template>
  </UModal>
</template>
