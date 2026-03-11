export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  parsedResponse?: {
    message: string
    prompt: string | null
    builder_state?: Record<string, string> | null
  }
}

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  general:
    'You are Grok, an expert AI assistant specialized in writing prompts for image and video generation models. You must always respond in valid JSON format with exactly two keys: "message" (your conversational reply) and "prompt" (the final, isolated compilation of the image/video generation prompt). If the user isn\'t asking for a prompt generation or enhancement yet, leave "prompt" as null.',
  person:
    'You are Grok, an expert AI character designer. Your goal is to help the user build a detailed "Person" prompt element. Ask the user questions to flesh out their character (appearance, clothing, vibe, etc.). You must always respond in valid JSON format with three keys: "message" (your conversational reply), "prompt" (null), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the character being built so far, e.g. {"age": "20s", "clothing": "cyberpunk trenchcoat"}). Update builder_state as the user provides more details.',
  scene:
    'You are Grok, an expert AI environment designer. Your goal is to help the user build a detailed "Scene" prompt element. Ask the user questions to flesh out their scene (lighting, architecture, atmosphere, etc.). You must always respond in valid JSON format with three keys: "message" (your conversational reply), "prompt" (null), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the scene being built so far). Update builder_state as the user provides more details.',
  framing:
    'You are Grok, an expert AI cinematographer. Your goal is to help the user build a detailed "Framing" prompt element. Ask the user questions to flesh out the framing (camera angle, lens, shot type, motion, etc.). You must always respond in valid JSON format with three keys: "message" (your conversational reply), "prompt" (null), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the framing being built so far). Update builder_state as the user provides more details.',
  action:
    'You are Grok, an expert AI action director. Your goal is to help the user build a detailed "Action" prompt element. Ask the user questions to flesh out the action (pose, movement, expression, etc.). You must always respond in valid JSON format with three keys: "message" (your conversational reply), "prompt" (null), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the action being built so far). Update builder_state as the user provides more details.',
}

export function useChatForm() {
  const { elements, fetchElements } = usePromptElements()

  const chatMode = ref<ChatMode>('general')
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const isChatting = ref(false)
  const error = ref<string | null>(null)

  watch(chatMode, () => {
    chatMessages.value = []
    initializeChat()
  })

  function initializeChat() {
    if (chatMessages.value.length === 0) {
      const mode = chatMode.value
      const initialMessage =
        mode === 'general'
          ? 'Hi! I can help you craft the perfect prompt for your next image or video. You can reference any of your saved Prompt Elements here. What are you thinking of creating?'
          : `Hi! Let's design a ${mode} together. What kind of ${mode} do you have in mind?`

      chatMessages.value = [
        {
          role: 'system',
          content: SYSTEM_PROMPTS[mode],
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            message: initialMessage,
            prompt: null,
            builder_state: null,
          }),
          parsedResponse: {
            message: initialMessage,
            prompt: null,
            builder_state: null,
          },
        },
      ]
    }
  }

  async function sendChatMessage() {
    if (!chatInput.value.trim() || isChatting.value) return

    const userText = chatInput.value
    chatInput.value = ''
    error.value = null

    chatMessages.value.push({ role: 'user', content: userText })
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

      // Replace the default system message with our enhanced one
      const payloadMessages = [...chatMessages.value]
      payloadMessages[0] = {
        role: 'system',
        content: `${payloadMessages[0]?.content || ''}\n\n${elementsContext}`,
      }

      const result = await $fetch<{ content: string }>('/api/generate/chat', {
        method: 'POST',
        body: {
          chatMode: chatMode.value,
          messages: payloadMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      })

      if (result.content) {
        const parsed: Required<NonNullable<ChatMessage['parsedResponse']>> = {
          message: result.content,
          prompt: null,
          builder_state: null,
        }
        try {
          const rawParsed = JSON.parse(result.content)
          if (rawParsed.message) parsed.message = rawParsed.message
          if (rawParsed.prompt) parsed.prompt = rawParsed.prompt
          if (rawParsed.builder_state) parsed.builder_state = rawParsed.builder_state
        } catch (parseErr) {
          console.warn('Grok did not return valid JSON', parseErr)
        }

        chatMessages.value.push({
          role: 'assistant',
          content: result.content,
          parsedResponse: parsed,
        })
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
    chatMessages,
    chatInput,
    isChatting,
    error,
    initializeChat,
    sendChatMessage,
  }
}
