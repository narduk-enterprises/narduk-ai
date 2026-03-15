import type { ChatMessage } from '~/types/chat'
import type { PromptElement, PresetMetadata } from './usePromptElements'
import { PRESET_ATTRIBUTES, attributesToContent } from '~/utils/presetSchemas'

// ─── Constants ─────────────────────────────────────────────
const MAX_CHAT_MESSAGES = 30

// ─── Composable ────────────────────────────────────────────
export function usePresetEditor() {
  const { updateElement, createElement } = usePromptElements()
  const { generateImage, generating: generatingPreview } = useGenerate()
  const toast = useToast()
  type ParsedResponse = NonNullable<ChatMessage['parsedResponse']>
  type BuilderState = ParsedResponse['builder_state']

  // ── Reactive State ──────────────────────────────────────
  const editableOverrides = reactive<Record<string, string | null>>({})
  const previewImageUrl = ref<string | null>(null)
  const headshotUrl = ref<string | null>(null)
  const currentPresetId = ref<string | null>(null)
  const presetType = ref<string | null>(null)
  const savingBuilder = ref(false)

  // ── Helpers ─────────────────────────────────────────────
  function formatKey(key: string | number): string {
    return String(key).replaceAll('_', ' ')
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  function normalizeBuilderState(value: unknown): BuilderState {
    if (!isRecord(value)) return null

    const normalized: Record<string, string | null> = {}

    for (const [key, entry] of Object.entries(value)) {
      if (entry == null) {
        normalized[key] = null
        continue
      }

      if (typeof entry === 'string') {
        normalized[key] = entry
        continue
      }

      normalized[key] = String(entry)
    }

    return Object.keys(normalized).length > 0 ? normalized : null
  }

  function parseAssistantResponse(content: ChatMessage['content']): ParsedResponse {
    if (typeof content !== 'string') {
      return {
        message: '',
        prompt: null,
        suggested_name: null,
        builder_state: null,
      }
    }

    try {
      const parsed = JSON.parse(content) as unknown
      if (isRecord(parsed)) {
        return {
          message: typeof parsed.message === 'string' ? parsed.message : content,
          prompt: typeof parsed.prompt === 'string' ? parsed.prompt : null,
          suggested_name: typeof parsed.suggested_name === 'string' ? parsed.suggested_name : null,
          builder_state: normalizeBuilderState(parsed.builder_state),
        }
      }
    } catch {
      /* fall back to XML-like parsing below */
    }

    const messageMatch = content.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
    const promptMatch = content.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
    const titleMatch = content.match(/<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i)
    const stateMatch = content.match(/<builder_state>([\s\S]*?)(?:<\/builder_state>|$)/i)

    let builderState: BuilderState = null
    if (stateMatch?.[1]) {
      try {
        builderState = normalizeBuilderState(JSON.parse(stateMatch[1].trim()))
      } catch {
        builderState = null
      }
    }

    return {
      message: messageMatch?.[1]?.trim() || content.replaceAll(/<[^>]+>/g, '').trim(),
      prompt: promptMatch?.[1]?.trim() || null,
      suggested_name: titleMatch?.[1]?.trim() || null,
      builder_state: builderState,
    }
  }

  function clearOverrides() {
    for (const key of Object.keys(editableOverrides)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing reactive object
      delete editableOverrides[key]
    }
  }

  // ── Builder State Computation ───────────────────────────
  /**
   * Derives the current builder state from chat messages.
   * Pass in the chatMessages ref from useChatForm.
   */
  function computeBuilderState(
    chatMessages: Ref<ChatMessage[]>,
    mode: string,
  ): Record<string, string | null> | null {
    if (mode === 'general') return null
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
  }

  /**
   * Merges the raw builder state with PERSON_ATTRIBUTES schema and user edits.
   */
  function mergeBuilderState(
    rawState: Record<string, string | null> | null,
    mode: string,
  ): Record<string, string | null> | null {
    if (!rawState) return null

    const schema = PRESET_ATTRIBUTES[mode]
    if (!schema) {
      // Unknown type — just overlay edits
      return { ...rawState, ...editableOverrides }
    }

    const merged: Record<string, string | null> = {}
    for (const attr of schema) {
      merged[attr] = editableOverrides[attr] ?? rawState[attr] ?? null
    }
    // Include extra attributes Grok returned outside the schema
    for (const [key, val] of Object.entries(rawState)) {
      if (!(key in merged)) merged[key] = editableOverrides[key] ?? val
    }
    return merged
  }

  // ── Attribute Editing ───────────────────────────────────
  function updateAttribute(key: string, value: string) {
    if (value.trim()) {
      editableOverrides[key] = value.trim()
    } else {
      editableOverrides[key] = null
    }
  }

  // ── Content / Metadata Builders ─────────────────────────
  function buildContentFromState(state: Record<string, string | null>): string {
    return attributesToContent(state)
  }

  function buildAttributesJson(state: Record<string, string | null>): string {
    // Strip null values for cleaner storage
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(state)) {
      if (v) clean[k] = v
    }
    return JSON.stringify(clean)
  }

  function buildMetadata(): string | null {
    const meta: PresetMetadata = {}
    if (headshotUrl.value) meta.headshotUrl = headshotUrl.value
    if (previewImageUrl.value) meta.fullBodyUrl = previewImageUrl.value
    return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
  }

  // ── Load Preset ─────────────────────────────────────────
  function loadPreset(element: PromptElement) {
    currentPresetId.value = element.id
    presetType.value = element.type
    clearOverrides()
    previewImageUrl.value = null
    headshotUrl.value = null

    // Restore images from metadata
    if (element.metadata) {
      try {
        const meta = JSON.parse(element.metadata) as PresetMetadata
        if (meta.fullBodyUrl) previewImageUrl.value = meta.fullBodyUrl
        if (meta.headshotUrl) headshotUrl.value = meta.headshotUrl
      } catch {
        /* ignore invalid JSON */
      }
    }
  }

  // ── Save Preset ─────────────────────────────────────────
  async function savePreset(
    state: Record<string, string | null>,
    mode: string,
    chatMessages?: Ref<ChatMessage[]>,
  ) {
    const content = buildContentFromState(state)
    if (!content) return

    const nameFromState = state.name || null
    const lastAssistant = chatMessages
      ? [...chatMessages.value].reverse().find((m) => m.role === 'assistant')
      : null
    const name = nameFromState || lastAssistant?.parsedResponse?.suggested_name || `New ${mode}`
    const metadataStr = buildMetadata()
    const attributesJson = buildAttributesJson(state)

    savingBuilder.value = true
    try {
      if (currentPresetId.value) {
        // Update existing — include attributes JSON
        await updateElement(currentPresetId.value, {
          name,
          content,
          metadata: metadataStr,
          attributes: attributesJson,
        })
      } else {
        // Create new — include attributes JSON
        const payloadType = mode as 'person' | 'scene' | 'framing' | 'action' | 'style' | 'clothing'
        const created = await createElement(payloadType, name, content, metadataStr, attributesJson)
        currentPresetId.value = created?.id ?? null
      }
      toast.add({
        title: 'Preset Saved',
        description: `"${name}" has been saved.`,
        icon: 'i-lucide-check-circle',
        color: 'success',
      })
    } catch {
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

  // ── Preview Generation ──────────────────────────────────
  async function generatePreview(state: Record<string, string | null>, type?: string) {
    const attrs = Object.entries(state)
      .filter(([k, v]) => v && k !== 'name' && k !== 'description')
      .map(([k, v]) => `${formatKey(k)}: ${v}`)
      .join(', ')

    const presetMode = type || presetType.value || 'person'

    previewImageUrl.value = null
    headshotUrl.value = null

    if (presetMode === 'person') {
      const fullBodyPrompt = `Full body portrait photograph of a person: ${attrs}. Standing pose facing the viewer, plain white background, studio lighting, clean and simple. Shot on 35mm lens, RAW photo, unretouched, natural skin texture, highly detailed, realistic, everyday authentic photography style, not CGI, not plasticy, no airbrushing. The person should be smiling naturally unless their description strongly implies they rarely smile.`
      const headshotPrompt = `Professional headshot portrait of a person: ${attrs}. Close-up face and shoulders, plain white background, studio lighting, sharp focus. Shot on 85mm lens, RAW photo, unretouched, natural skin texture, highly detailed, realistic, authentic photography, not CGI, not plasticy, no airbrushing. The person should be smiling naturally unless their description strongly implies they rarely smile.`

      const presets = state.name ? { [presetMode]: state.name } : undefined

      const [fullBodyResult, headshotResult] = await Promise.allSettled([
        generateImage(fullBodyPrompt, { aspectRatio: '9:16', presets }),
        generateImage(headshotPrompt, { aspectRatio: '1:1', presets }),
      ])

      if (fullBodyResult.status === 'fulfilled' && fullBodyResult.value?.mediaUrl) {
        previewImageUrl.value = fullBodyResult.value.mediaUrl
      }
      if (headshotResult.status === 'fulfilled' && headshotResult.value?.mediaUrl) {
        headshotUrl.value = headshotResult.value.mediaUrl
      }
    } else if (presetMode === 'scene') {
      const prompt = `A cinematic wide-angle photograph of a scene: ${attrs}. Cinematic composition, ultra-detailed environment, atmospheric, high quality, photorealistic, no people.`
      const presets = state.name ? { [presetMode]: state.name } : undefined
      const result = await generateImage(prompt, { aspectRatio: '16:9', presets }).catch(() => null)
      if (result?.mediaUrl) previewImageUrl.value = result.mediaUrl
    } else if (presetMode === 'framing') {
      const prompt = `A demonstration of camera framing and composition: ${attrs}. Show the framing technique with a generic subject in a neutral environment, cinematic quality, photorealistic.`
      const presets = state.name ? { [presetMode]: state.name } : undefined
      const result = await generateImage(prompt, { aspectRatio: '16:9', presets }).catch(() => null)
      if (result?.mediaUrl) previewImageUrl.value = result.mediaUrl
    } else if (presetMode === 'action') {
      const prompt = `A dynamic photograph of a person performing an action: ${attrs}. Dramatic lighting, high energy, motion captured, photorealistic, high quality.`
      const presets = state.name ? { [presetMode]: state.name } : undefined
      const result = await generateImage(prompt, { aspectRatio: '9:16', presets }).catch(() => null)
      if (result?.mediaUrl) previewImageUrl.value = result.mediaUrl
    } else if (presetMode === 'style') {
      const prompt = `An artistic demonstration of a specific visual style: ${attrs}. Clearly exhibit the unique aesthetics, medium, and techniques described. Masterpiece, highly detailed.`
      const presets = state.name ? { [presetMode]: state.name } : undefined
      const result = await generateImage(prompt, { aspectRatio: '1:1', presets }).catch(() => null)
      if (result?.mediaUrl) previewImageUrl.value = result.mediaUrl
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

  // ── Debounced Auto-Save ─────────────────────────────────
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  const AUTO_SAVE_DELAY = 1500

  function scheduleAutoSave(state: Record<string, string | null> | null) {
    if (!currentPresetId.value || !state) return
    // Don't save if content is empty/whitespace (brand new preset with no work)
    const content = buildContentFromState(state)
    if (!content || !content.trim()) return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(async () => {
      const id = currentPresetId.value
      if (!id || !state) return
      const latestContent = buildContentFromState(state)
      if (!latestContent || !latestContent.trim()) return
      try {
        const name = state.name || undefined
        await updateElement(id, {
          ...(name && { name }),
          content: latestContent,
          attributes: buildAttributesJson(state),
          metadata: buildMetadata(),
        })
      } catch {
        /* silent — auto-saves are best-effort */
      }
    }, AUTO_SAVE_DELAY)
  }

  // ── Chat History Persistence ────────────────────────────
  let chatSaveTimer: ReturnType<typeof setTimeout> | null = null
  const CHAT_SAVE_DELAY = 2000

  function scheduleChatSave(messages: ChatMessage[]) {
    if (!currentPresetId.value) return
    if (chatSaveTimer) clearTimeout(chatSaveTimer)
    chatSaveTimer = setTimeout(async () => {
      const id = currentPresetId.value
      if (!id) return
      try {
        // Cap messages: keep system + last N messages
        const systemMsgs = messages.filter((m) => m.role === 'system')
        const nonSystemMsgs = messages.filter((m) => m.role !== 'system')
        const capped = [...systemMsgs, ...nonSystemMsgs.slice(-MAX_CHAT_MESSAGES)]
        // Strip parsedResponse to save space (it's re-derived on load)
        const serializable = capped.map((m) => ({
          role: m.role,
          content: m.content,
        }))
        await updateElement(id, { chatHistory: JSON.stringify(serializable) })
      } catch {
        /* silent — chat saves are best-effort */
      }
    }, CHAT_SAVE_DELAY)
  }

  function loadChatHistory(element: PromptElement): ChatMessage[] | null {
    if (!element.chatHistory) return null
    try {
      const raw = JSON.parse(element.chatHistory) as Array<{
        role: string
        content: ChatMessage['content']
      }>
      return raw.map((m) => {
        const msg: ChatMessage = {
          role: m.role as ChatMessage['role'],
          content: m.content,
        }
        if (m.role === 'assistant') {
          msg.parsedResponse = parseAssistantResponse(m.content)
        }
        return msg
      })
    } catch {
      return null
    }
  }

  async function clearChatHistory() {
    if (!currentPresetId.value) return
    try {
      await updateElement(currentPresetId.value, { chatHistory: null })
    } catch {
      /* silent */
    }
  }

  // ── Reset ───────────────────────────────────────────────
  function resetState() {
    clearOverrides()
    previewImageUrl.value = null
    headshotUrl.value = null
    currentPresetId.value = null
    presetType.value = null
  }

  // ── Fetch Single Preset ─────────────────────────────────
  function fetchPresetById(id: string | Ref<string>) {
    return useFetch<PromptElement>(() => `/api/elements/${unref(id)}`, {
      key: `preset-${unref(id)}`,
    })
  }

  return {
    // State
    editableOverrides,
    previewImageUrl,
    headshotUrl,
    currentPresetId,
    presetType,
    savingBuilder,
    generatingPreview,

    // Computations
    computeBuilderState,
    mergeBuilderState,

    // Actions
    loadPreset,
    savePreset,
    updateAttribute,
    generatePreview,
    scheduleAutoSave,
    scheduleChatSave,
    loadChatHistory,
    clearChatHistory,
    resetState,
    clearOverrides,

    // Helpers
    formatKey,
    buildContentFromState,
    buildMetadata,
    fetchPresetById,
  }
}
