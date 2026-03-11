export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action' | 'style'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  parsedResponse?: {
    message: string
    prompt: string | null
    suggested_name?: string | null
    builder_state?: Record<string, string | null> | null
  }
}

export function useChatForm() {
  const { elements, fetchElements } = usePromptElements()
  const { prompts } = useSystemPrompts()
  const { allModifiersList } = useQuickModifiers()

  const chatMode = ref<ChatMode>('general')
  const mediaType = ref<'image' | 'video'>('image')
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const isChatting = ref(false)
  const error = ref<string | null>(null)

  watch(chatMode, () => {
    chatMessages.value = []
    initializeChat()
  })

  async function initializeChat() {
    if (chatMessages.value.length === 0) {
      const mode = chatMode.value
      const initialMessage =
        mode === 'general'
          ? 'Hi! I can help you craft the perfect prompt for your next image or video. You can reference any of your saved Prompt Elements here. What are you thinking of creating?'
          : `Hi! Let's design a ${mode} together. What kind of ${mode} do you have in mind?`

      const promptKey = `chat_${mode}`
      const baseSystemPrompt = prompts.value[promptKey] || ''
      const mediaContext =
        mode === 'general' && mediaType.value === 'video'
          ? '\\n\\nIMPORTANT: The user is currently creating a VIDEO prompt for Grok Imagine. Optimize all prompts for video generation — emphasize motion, temporal progression, camera movement, pacing, and cinematic dynamics rather than static composition.'
          : ''

      chatMessages.value = [
        {
          role: 'system',
          content: `${baseSystemPrompt}${mediaContext}`,
        },
        {
          role: 'assistant',
          content: `<message>${initialMessage}</message>`,
          parsedResponse: {
            message: initialMessage,
            prompt: null,
            builder_state: null,
          },
        },
      ]
    }
  }

  async function sendChatMessage(contextString?: string) {
    if (!chatInput.value.trim() || isChatting.value) return

    const userText = chatInput.value
    chatInput.value = ''
    error.value = null

    const finalUserText = contextString
      ? `${userText}\n\nCURRENT UI STATE:\n${contextString}`
      : userText

    chatMessages.value.push({ role: 'user', content: finalUserText })
    isChatting.value = true

    try {
      // Build dynamic system prompt containing the user's elements context
      const elementsContext = elements.value.length
        ? `The user has the following saved Prompt Elements in their library:\n${elements.value
            .map((e) => `- [${e.type}] "${e.name}": ${e.content}`)
            .join(
              '\n',
            )}\n\nMake sure to deeply reference or combine these if the user asks for them.`
        : 'The user has no saved Prompt Elements yet.'

      // Build Quick Modifiers Context
      const modifiersContext = allModifiersList.value.length
        ? `\n\nThe user's app supports the following "Quick Modifiers" that you can toggle by emitting their ID in your JSON <builder_state> response. Use them exactly as listed below:\n` +
          allModifiersList.value
            .map(
              (m) =>
                `- ID: ${m.id} (Category: ${m.category}, Label: ${m.label}) - INSERTS: "${m.snippet}"`,
            )
            .join('\n')
        : ''

      // Replace the default system message with our enhanced one
      const payloadMessages = [...chatMessages.value]
      payloadMessages[0] = {
        role: 'system',
        content: `${payloadMessages[0]?.content || ''}\n\n${elementsContext}${modifiersContext}`,
      }

      chatMessages.value.push({
        role: 'assistant',
        content: '',
        parsedResponse: {
          message: '',
          prompt: null,
          suggested_name: null,
          builder_state: null,
        },
      })
      const assistantIndex = chatMessages.value.length - 1

      const res = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          chatMode: chatMode.value,
          messages: payloadMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      })

      if (!res.ok || !res.body) throw new Error('API Error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const parsed: Required<NonNullable<ChatMessage['parsedResponse']>> = {
        message: '',
        prompt: null,
        suggested_name: null,
        builder_state: null,
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })

        const msgMatch = fullContent.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
        const promptMatch = fullContent.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
        const titleMatch = fullContent.match(
          /<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i,
        )
        const stateMatch = fullContent.match(/<builder_state>([\s\S]*?)(?:<\/builder_state>|$)/i)

        if (msgMatch?.[1]) parsed.message = msgMatch[1].trim()
        if (promptMatch?.[1]) parsed.prompt = promptMatch[1].trim()
        if (titleMatch?.[1]) parsed.suggested_name = titleMatch[1].trim()

        if (stateMatch?.[1]) {
          try {
            parsed.builder_state = JSON.parse(stateMatch[1].trim())
          } catch {
            // Wait for complete JSON
          }
        }

        const msg = chatMessages.value[assistantIndex]!
        msg.content = fullContent
        msg.parsedResponse = { ...parsed }
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to get chat response'
    } finally {
      isChatting.value = false
    }
  }

  return {
    elements,
    fetchElements,
    chatMode,
    mediaType,
    chatMessages,
    chatInput,
    isChatting,
    error,
    initializeChat,
    sendChatMessage,
  }
}
