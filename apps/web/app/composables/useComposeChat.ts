/**
 * Composable for the Compose page's streaming chat logic.
 * Manages chat messages, streaming, draft prompt updates, and title extraction.
 */
export function useComposeChat(options: {
  systemPrompts: Ref<Record<string, string>>
  allModifiersList: Ref<{ attributeKey: string; label: string; snippet: string }[]>
  mediaType: Ref<'image' | 'video'>
  composeSelection: Record<string, string | null>
  elements: Ref<{ type: string; name: string; content: string }[]>
}) {
  const chatMessages = ref<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([])
  const chatLog = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
  const currentPromptDraft = ref('')
  const chatInput = ref('')
  const chatting = ref(false)
  const savedPromptId = ref<string | null>(null)
  const saveTitle = ref('')

  function buildModifiersContext() {
    if (!options.allModifiersList.value.length) return ''
    return (
      '\n\nYou can also suggest enhancements using Quick Modifiers if applicable. When suggesting modifications, emit attribute-value pairs in your <builder_state> JSON response using attribute keys (e.g. {"hair_color": "blonde", "lighting": "golden hour"}). Available modifiers:\n' +
      options.allModifiersList.value
        .map((m) => `- ${m.attributeKey}: "${m.label}" → "${m.snippet}"`)
        .join('\n')
    )
  }

  function buildComponentParts() {
    return Object.entries(options.composeSelection)
      .filter(([_, val]) => val)
      .map(([key, name]) => {
        const el = options.elements.value.find((e) => e.type === key && e.name === name)
        return `${key}: ${el?.content || name}`
      })
      .join('\n')
  }

  async function composeDraft() {
    const parts = buildComponentParts()
    if (!parts) return

    chatting.value = true
    currentPromptDraft.value = ''
    chatLog.value = []
    savedPromptId.value = null

    const isVideo = options.mediaType.value === 'video'
    const sysContent = isVideo
      ? options.systemPrompts.value.compose_video
      : options.systemPrompts.value.compose_image

    chatMessages.value = [
      { role: 'system', content: (sysContent || '') + buildModifiersContext() },
      {
        role: 'user',
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

  async function sendMessage() {
    if (!chatInput.value.trim() || chatting.value) return

    const text = chatInput.value.trim()
    chatInput.value = ''
    chatLog.value.push({ role: 'user', text })
    chatting.value = true

    const stateContext = currentPromptDraft.value
      ? `\n\nCURRENT PROMPT DRAFT:\n${currentPromptDraft.value}`
      : ''
    chatMessages.value.push({ role: 'user', content: `${text}${stateContext}` })

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
      sendMessage()
    }
  }

  function reset() {
    chatMessages.value = []
    chatLog.value = []
    currentPromptDraft.value = ''
    chatInput.value = ''
    savedPromptId.value = null
    saveTitle.value = ''
  }

  return {
    chatMessages,
    chatLog,
    currentPromptDraft,
    chatInput,
    chatting,
    savedPromptId,
    saveTitle,
    composeDraft,
    sendMessage,
    handleChatKeydown,
    reset,
  }
}
