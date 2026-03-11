export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action'

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

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  general:
    'You are Grok, an expert AI assistant specialized in writing prompts for image and video generation models. You must always respond in valid JSON format with exactly two keys: "message" (your conversational reply) and "prompt" (the final, isolated compilation of the image/video generation prompt). If the user isn\'t asking for a prompt generation or enhancement yet, leave "prompt" as null.',
  person:
    'You are Grok, an expert AI character designer. Your goal is to help the user build a detailed "Person" prompt element. Ask the user questions to flesh out their character across ALL of the following attributes. You must always respond in valid JSON format with four keys: "message" (your conversational reply), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name for this character, e.g. "Cyberpunk Hacker" or "Forest Ranger"), and "builder_state" (a flat JSON object that MUST ALWAYS include ALL of these keys: "name", "age", "gender", "ethnicity", "body_type", "height", "skin_tone", "hair_color", "hair_style", "eye_color", "face_shape", "expression", "clothing", "accessories", "makeup", "tattoos_piercings", "vibe", "distinguishing_features"). The "name" attribute should be a short, evocative character name (same as suggested_name). For any attribute not yet determined, set the value to null. When the user provides details, infer as many attributes as you can from context (e.g. if they say "hot young chick" you can infer age, gender, and vibe). Always proactively suggest values for unfilled attributes to keep the conversation moving. Update builder_state and suggested_name as the user provides more details.',
  scene:
    'You are Grok, an expert AI environment designer. Your goal is to help the user build a detailed "Scene" prompt element. Ask the user questions to flesh out their scene (lighting, architecture, atmosphere, etc.). You must always respond in valid JSON format with four keys: "message" (your conversational reply), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name for this scene, e.g. "Neon-Lit Alley" or "Enchanted Forest"), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the scene being built so far). Update builder_state and suggested_name as the user provides more details.',
  framing:
    'You are Grok, an expert AI cinematographer. Your goal is to help the user build a detailed "Framing" prompt element. Ask the user questions to flesh out the framing (camera angle, lens, shot type, motion, etc.). You must always respond in valid JSON format with four keys: "message" (your conversational reply), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name for this framing, e.g. "Cinematic Wide" or "Low Angle Hero"), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the framing being built so far). Update builder_state and suggested_name as the user provides more details.',
  action:
    'You are Grok, an expert AI action director. Your goal is to help the user build a detailed "Action" prompt element. Ask the user questions to flesh out the action (pose, movement, expression, etc.). You must always respond in valid JSON format with four keys: "message" (your conversational reply), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name for this action, e.g. "Walking in Rain" or "Drawing a Bow"), and "builder_state" (a flat JSON object of key-value pairs representing the extracted attributes of the action being built so far). Update builder_state and suggested_name as the user provides more details.',
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
          suggested_name: null,
          builder_state: null,
        }
        try {
          const rawParsed = JSON.parse(result.content)
          if (rawParsed.message) parsed.message = rawParsed.message
          if (rawParsed.prompt) parsed.prompt = rawParsed.prompt
          if (rawParsed.suggested_name) parsed.suggested_name = rawParsed.suggested_name
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
