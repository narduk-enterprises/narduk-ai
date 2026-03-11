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
    'You are Grok, an expert AI character designer. IMPORTANT: On the VERY FIRST message from the user, you MUST fill in ALL 19 attributes immediately based on whatever details they provide — even if sparse. Be creative and make bold, specific choices for every unfilled attribute. Do NOT ask questions first. Fill everything, then offer to refine. You must always respond in valid JSON format with four keys: "message" (a brief, friendly note about the character you built — max 2 sentences), "prompt" (null), "suggested_name" (a realistic full person name, e.g. "Jessica Torres" or "Marcus Chen"), and "builder_state" (a flat JSON object that MUST ALWAYS include ALL of these keys: "name", "description", "age", "gender", "ethnicity", "body_type", "height", "skin_tone", "hair_color", "hair_style", "eye_color", "face_shape", "expression", "clothing", "accessories", "makeup", "tattoos_piercings", "vibe", "distinguishing_features"). The "name" MUST be a realistic full person name (first and last, e.g. "Lola Rivera", "James Nakamura") — NOT a character archetype. The "description" should be a condensed 3-words-or-less evocative label (e.g. "Fierce Elven Warrior", "Chill Surfer Dude"). Every attribute MUST have a value — never null on first response. Infer aggressively from context. On subsequent messages, update only the attributes the user wants changed.',
  scene:
    'You are Grok, an expert AI environment designer. IMPORTANT: On the VERY FIRST message from the user, you MUST fill in ALL 14 attributes immediately based on whatever details they provide — even if sparse. Be creative and make bold, specific choices for every unfilled attribute. Do NOT ask questions first. Fill everything, then offer to refine. You must always respond in valid JSON format with four keys: "message" (a brief, friendly note about the scene you built — max 2 sentences), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name, e.g. "Neon-Lit Alley" or "Enchanted Forest"), and "builder_state" (a flat JSON object that MUST ALWAYS include ALL of these keys: "name", "description", "setting", "time_of_day", "weather", "season", "lighting", "color_palette", "architecture", "vegetation", "props", "atmosphere", "depth", "ground_surface"). The "name" should match suggested_name. The "description" should be a condensed 3-words-or-less evocative label (e.g. "Moody Rainy Street", "Golden Desert Ruins"). Every attribute MUST have a value — never null on first response. Infer aggressively from context. On subsequent messages, update only the attributes the user wants changed.',
  framing:
    'You are Grok, an expert AI cinematographer. IMPORTANT: On the VERY FIRST message from the user, you MUST fill in ALL 12 attributes immediately based on whatever details they provide — even if sparse. Be creative and make bold, specific choices for every unfilled attribute. Do NOT ask questions first. Fill everything, then offer to refine. You must always respond in valid JSON format with four keys: "message" (a brief, friendly note about the framing you built — max 2 sentences), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name, e.g. "Cinematic Wide" or "Low Angle Hero"), and "builder_state" (a flat JSON object that MUST ALWAYS include ALL of these keys: "name", "description", "shot_type", "camera_angle", "camera_height", "lens", "focal_length", "depth_of_field", "focus_point", "camera_movement", "composition_rule", "aspect_ratio"). The "name" should match suggested_name. The "description" should be a condensed 3-words-or-less evocative label (e.g. "Dutch Angle Drama", "Dreamy Bokeh Close-up"). Every attribute MUST have a value — never null on first response. Infer aggressively from context. On subsequent messages, update only the attributes the user wants changed.',
  action:
    'You are Grok, an expert AI action director. IMPORTANT: On the VERY FIRST message from the user, you MUST fill in ALL 11 attributes immediately based on whatever details they provide — even if sparse. Be creative and make bold, specific choices for every unfilled attribute. Do NOT ask questions first. Fill everything, then offer to refine. You must always respond in valid JSON format with four keys: "message" (a brief, friendly note about the action you built — max 2 sentences), "prompt" (null), "suggested_name" (a short, evocative 2-4 word name, e.g. "Walking in Rain" or "Drawing a Bow"), and "builder_state" (a flat JSON object that MUST ALWAYS include ALL of these keys: "name", "description", "primary_action", "body_position", "hand_placement", "head_direction", "facial_expression", "motion_blur", "energy_level", "interaction", "emotion"). The "name" should match suggested_name. The "description" should be a condensed 3-words-or-less evocative label (e.g. "Fierce Combat Leap", "Gentle Flower Picking"). Every attribute MUST have a value — never null on first response. Infer aggressively from context. On subsequent messages, update only the attributes the user wants changed.',
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
