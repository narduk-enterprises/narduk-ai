export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action' | 'style'

export type ChatModelId = 'grok-3-mini' | 'grok-3' | 'grok-2-1212' | 'grok-2-vision-1212'

export interface ChatModel {
  id: ChatModelId
  label: string
  supportsVision: boolean
}

export const CHAT_MODELS: ChatModel[] = [
  { id: 'grok-3-mini', label: 'Grok 3 Mini', supportsVision: false },
  { id: 'grok-3', label: 'Grok 3', supportsVision: false },
  { id: 'grok-2-1212', label: 'Grok 2', supportsVision: false },
  { id: 'grok-2-vision-1212', label: 'Grok 2 Vision', supportsVision: true },
]

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
  parsedResponse?: {
    message: string
    prompt: string | null
    suggested_name?: string | null
    builder_state?: Record<string, string | null> | null
    imageUrl?: string | null
    isInlineGeneration?: boolean
  }
}

export function useChatForm() {
  const { elements, fetchElements } = usePromptElements()
  const { prompts } = useSystemPrompts()
  const { ensureLoaded: ensureTagsLoaded } = usePromptTags()

  const chatMode = ref<ChatMode>('general')
  const mediaType = ref<'image' | 'video'>('image')
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const isChatting = ref(false)
  const generatingInline = ref(false)
  const error = ref<string | null>(null)
  const selectedModel = ref<ChatModelId>('grok-3-mini')

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
          ? '\n\nIMPORTANT: The user is currently creating a VIDEO prompt for Grok Imagine. Optimize all prompts for video generation — emphasize motion, temporal progression, camera movement, pacing, and cinematic dynamics rather than static composition.'
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

  /**
   * Helper to get a string version of a message's content for API payloads
   * that need content as a string (e.g. filtering empty messages).
   */
  function contentAsString(content: string | ContentPart[]): string {
    if (typeof content === 'string') return content
    return content
      .map((p) => (p.type === 'text' ? p.text : '[image]'))
      .join(' ')
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

    let assistantIndex = -1

    try {
      // Ensure tags are loaded for context
      await ensureTagsLoaded()

      // Build dynamic system prompt containing the user's elements context
      const elementsContext = elements.value.length
        ? `The user has the following saved Prompt Elements in their library:\n${elements.value
            .map((e) => `- [${e.type}] "${e.name}": ${e.content}`)
            .join(
              '\n',
            )}\n\nMake sure to deeply reference or combine these if the user asks for them.`
        : 'The user has no saved Prompt Elements yet.'

      // Describe to the model that it should suggest attribute modifiers within the bounds of the schema
      const modifiersContext = `\n\nThe app supports "Quick Modifiers" organized by attribute key. When suggesting modifications, emit attribute-value pairs in your <builder_state> JSON response using the attribute keys defined in the schema (e.g. {"hair_color": "blonde", "lighting": "golden hour"}).`

      // Schema registry context — gives the agent full attribute schema awareness
      const schemaContext = `\n\n${schemaToPromptContext()}`

      // Pipeline algorithm context — lets the agent understand and debug compilation
      const pipelineContext = `\n\n${compilationPipelineDescription()}`

      // Assemble base system prompt defensively in case it wasn't loaded at init time
      let baseSystemPrompt = prompts.value[`chat_${chatMode.value}`]
      if (!baseSystemPrompt) {
        try {
          // Pass cookies from the current request to ensure auth works (SSR only)
          const headers = import.meta.server
            ? (useRequestHeaders(['cookie']) as Record<string, string>)
            : undefined
          const fresh = await $fetch<Record<string, string>>('/api/system-prompts', {
            ...(headers && { headers }),
          })
          baseSystemPrompt = fresh[`chat_${chatMode.value}`] || ''
        } catch (e) {
          console.error('Failed to load system prompts:', e)
          baseSystemPrompt = ''
        }
      }

      const mediaContext =
        chatMode.value === 'general' && mediaType.value === 'video'
          ? '\n\nIMPORTANT: The user is currently creating a VIDEO prompt for Grok Imagine. Optimize all prompts for video generation — emphasize motion, temporal progression, camera movement, pacing, and cinematic dynamics rather than static composition.'
          : ''

      // Replace the default system message with our enhanced one
      const payloadMessages = [...chatMessages.value]
      payloadMessages[0] = {
        role: 'system',
        content: `${baseSystemPrompt}${mediaContext}\n\n${elementsContext}${modifiersContext}${schemaContext}${pipelineContext}`,
      }

      // Backfill the client-side system message so it saves correctly.
      // Guard: only overwrite when baseSystemPrompt is non-empty to prevent
      // corrupting the slot when prompts haven't loaded yet (timing issue on preset editor).
      if (
        baseSystemPrompt &&
        chatMessages.value.length > 0 &&
        chatMessages.value[0]?.role === 'system'
      ) {
        chatMessages.value[0].content = `${baseSystemPrompt}${mediaContext}`
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
      assistantIndex = chatMessages.value.length - 1

      const res = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          chatMode: chatMode.value,
          model: selectedModel.value,
          // Filter out any messages with empty content to avoid Zod min(1) failures
          // (can happen if initializeChat ran before prompts loaded, or stream was interrupted)
          messages: payloadMessages
            .map((m) => ({ role: m.role, content: m.content }))
            .filter((m) => {
              const str = contentAsString(m.content)
              return str.trim().length > 0
            }),
          stream: true,
        }),
      })

      if (!res.ok) throw new Error(`API Error (${res.status})`)

      // On Cloudflare edge nodes, sendStream() can occasionally return a null body
      // on an otherwise successful 200 response. Bail out gracefully instead of
      // showing a false error to the user.
      if (!res.body) {
        console.warn('[useChatForm] res.body is null on a 200 OK — skipping stream read')
        if (assistantIndex >= 0) {
          const msg = chatMessages.value[assistantIndex]
          if (msg) {
            msg.content = '<message>Sorry, the response was empty. Please try again.</message>'
            msg.parsedResponse = {
              message: 'Sorry, the response was empty. Please try again.',
              prompt: null,
              suggested_name: null,
              builder_state: null,
            }
          }
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const parsed: Required<NonNullable<ChatMessage['parsedResponse']>> = {
        message: '',
        prompt: null,
        suggested_name: null,
        builder_state: null,
        imageUrl: null,
        isInlineGeneration: false,
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
      const errorMsg = err.data?.message || err.message || 'Failed to get chat response'
      error.value = errorMsg

      // Update the empty assistant message with a visible error so the user sees feedback
      if (assistantIndex >= 0) {
        const msg = chatMessages.value[assistantIndex]
        if (msg) {
          msg.content = `<message>${errorMsg}</message>`
          msg.parsedResponse = {
            message: `⚠️ ${errorMsg}`,
            prompt: null,
            suggested_name: null,
            builder_state: null,
          }
        }
      }
    } finally {
      isChatting.value = false
    }
  }

  /**
   * Generate an image inline in the chat thread without navigating away.
   * Injects a synthetic assistant message with the result image.
   */
  async function generateInline(prompt: string) {
    if (generatingInline.value) return
    generatingInline.value = true
    error.value = null

    // Inject a placeholder assistant message immediately
    chatMessages.value.push({
      role: 'assistant',
      content: '<message>Generating image…</message>',
      parsedResponse: {
        message: 'Generating image…',
        prompt,
        suggested_name: null,
        builder_state: null,
        imageUrl: null,
        isInlineGeneration: true,
      },
    })
    const placeholderIndex = chatMessages.value.length - 1

    try {
      const result = await $fetch<{ mediaUrl: string; id: string }>(
        '/api/generate/image',
        {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: { prompt },
        },
      )

      const msg = chatMessages.value[placeholderIndex]
      if (msg) {
        const successMsg = 'Here's your generated image! You can share it with me to get feedback or ideas for next steps.'
        msg.content = `<message>${successMsg}</message>`
        msg.parsedResponse = {
          message: successMsg,
          prompt,
          suggested_name: null,
          builder_state: null,
          imageUrl: result.mediaUrl,
          isInlineGeneration: true,
        }
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      const errorMsg = err.data?.message || err.message || 'Image generation failed'
      error.value = errorMsg

      const msg = chatMessages.value[placeholderIndex]
      if (msg) {
        msg.content = `<message>⚠️ ${errorMsg}</message>`
        msg.parsedResponse = {
          message: `⚠️ ${errorMsg}`,
          prompt,
          suggested_name: null,
          builder_state: null,
          imageUrl: null,
          isInlineGeneration: true,
        }
      }
    } finally {
      generatingInline.value = false
    }
  }

  /**
   * Send a generated image back to the chat agent as a vision message.
   * Automatically switches to a vision-capable model for that turn.
   */
  async function shareImageWithAgent(imageUrl: string, userComment?: string) {
    if (isChatting.value) return
    error.value = null

    // Build the vision message
    const text = userComment?.trim() || 'Here is the generated image. What do you think? Can you suggest improvements or next steps?'
    const visionContent: ContentPart[] = [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageUrl } },
    ]

    // Remember current model and switch to vision if needed
    const originalModel = selectedModel.value
    const needsVisionSwitch = selectedModel.value !== 'grok-2-vision-1212'
    if (needsVisionSwitch) {
      selectedModel.value = 'grok-2-vision-1212'
    }

    // Inject user message with the image
    chatMessages.value.push({ role: 'user', content: visionContent })
    isChatting.value = true

    let assistantIndex = -1

    try {
      await ensureTagsLoaded()

      let baseSystemPrompt = prompts.value[`chat_${chatMode.value}`] || ''
      const elementsContext = elements.value.length
        ? `The user has the following saved Prompt Elements in their library:\n${elements.value
            .map((e) => `- [${e.type}] "${e.name}": ${e.content}`)
            .join('\n')}`
        : 'The user has no saved Prompt Elements yet.'

      const payloadMessages = [...chatMessages.value]
      payloadMessages[0] = {
        role: 'system',
        content: `${baseSystemPrompt}\n\n${elementsContext}`,
      }

      chatMessages.value.push({
        role: 'assistant',
        content: '',
        parsedResponse: { message: '', prompt: null, suggested_name: null, builder_state: null },
      })
      assistantIndex = chatMessages.value.length - 1

      // Show "Switched to vision model" notice
      if (needsVisionSwitch) {
        const switchMsg = chatMessages.value[assistantIndex]
        if (switchMsg) {
          switchMsg.parsedResponse = {
            message: '_(Switched to Grok 2 Vision for image analysis)_',
            prompt: null,
            suggested_name: null,
            builder_state: null,
          }
        }
      }

      const res = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          chatMode: chatMode.value,
          model: 'grok-2-vision-1212',
          messages: payloadMessages
            .map((m) => ({ role: m.role, content: m.content }))
            .filter((m) => {
              const str = contentAsString(m.content)
              return str.trim().length > 0
            }),
          stream: true,
        }),
      })

      if (!res.ok) throw new Error(`API Error (${res.status})`)

      if (!res.body) {
        console.warn('[useChatForm] res.body is null on vision turn')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const parsed: Required<NonNullable<ChatMessage['parsedResponse']>> = {
        message: '',
        prompt: null,
        suggested_name: null,
        builder_state: null,
        imageUrl: null,
        isInlineGeneration: false,
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })

        const msgMatch = fullContent.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
        const promptMatch = fullContent.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
        const titleMatch = fullContent.match(/<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i)
        const stateMatch = fullContent.match(/<builder_state>([\s\S]*?)(?:<\/builder_state>|$)/i)

        if (msgMatch?.[1]) parsed.message = msgMatch[1].trim()
        if (promptMatch?.[1]) parsed.prompt = promptMatch[1].trim()
        if (titleMatch?.[1]) parsed.suggested_name = titleMatch[1].trim()
        if (stateMatch?.[1]) {
          try { parsed.builder_state = JSON.parse(stateMatch[1].trim()) } catch { /* wait */ }
        }

        const msg = chatMessages.value[assistantIndex]!
        msg.content = fullContent
        msg.parsedResponse = { ...parsed }
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      const errorMsg = err.data?.message || err.message || 'Failed to get vision response'
      error.value = errorMsg
      if (assistantIndex >= 0) {
        const msg = chatMessages.value[assistantIndex]
        if (msg) {
          msg.content = `<message>${errorMsg}</message>`
          msg.parsedResponse = {
            message: `⚠️ ${errorMsg}`,
            prompt: null,
            suggested_name: null,
            builder_state: null,
          }
        }
      }
    } finally {
      isChatting.value = false
      // Restore original model after vision turn
      if (needsVisionSwitch) {
        selectedModel.value = originalModel
      }
    }
  }

  function startNewChat() {
    chatMessages.value = []
    chatInput.value = ''
    error.value = null
    initializeChat()
  }

  return {
    elements,
    fetchElements,
    chatMode,
    mediaType,
    chatMessages,
    chatInput,
    isChatting,
    generatingInline,
    error,
    selectedModel,
    initializeChat,
    sendChatMessage,
    generateInline,
    shareImageWithAgent,
    startNewChat,
  }
}
