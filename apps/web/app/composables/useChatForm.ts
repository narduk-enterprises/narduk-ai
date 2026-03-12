import { payloadNeedsVision, resolveVisionImageUrl } from '~/utils/visionImage'

export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action' | 'style'

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

export type ChatPersistenceMode = 'memory' | 'session'

interface UseChatFormOptions {
  persistence?: ChatPersistenceMode
  resumeMode?: ChatMode
}

const INLINE_IMAGE_ACKNOWLEDGEMENT_PROMPT =
  'I am sharing the image you just generated. Acknowledge receipt in one very short sentence by briefly describing what you received, then wait for my next instruction. Do not suggest edits, ideas, or next steps yet.'

export function useChatForm(options: UseChatFormOptions = {}) {
  const { elements, fetchElements } = usePromptElements()
  const { prompts } = useSystemPrompts()
  const { ensureLoaded: ensureTagsLoaded } = usePromptTags()
  const {
    chatModels,
    preferredChatModel,
    preferredVisionModel,
    refresh: refreshModels,
  } = useXaiModels()
  const sessions = useChatSessions()
  const persistence = options.persistence ?? 'memory'
  const usesSessionPersistence = persistence === 'session'

  const chatMode = ref<ChatMode>('general')
  const mediaType = ref<'image' | 'video'>('image')
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const isChatting = ref(false)
  const generatingInline = ref(false)
  const error = ref<string | null>(null)
  const selectedModel = ref<string>('')

  watchEffect(() => {
    if (!chatModels.value.length) return

    if (!selectedModel.value || !chatModels.value.includes(selectedModel.value)) {
      selectedModel.value = preferredChatModel.value || chatModels.value[0]!
    }
  })

  watch(chatMode, () => {
    chatMessages.value = []
    initializeChat()
  })

  async function initializeChat() {
    if (usesSessionPersistence) {
      // Only the standalone brainstorm chat should restore D1-backed sessions.
      await sessions.fetchSessions()

      const latestSession = options.resumeMode
        ? sessions.sessions.value.find((session) => session.mode === options.resumeMode)
        : sessions.sessions.value[0]

      if (latestSession) {
        // Resume existing session
        chatMode.value = (latestSession.mode as ChatMode) || 'general'
        selectedModel.value = latestSession.model || ''
        const persisted = await sessions.loadSession(latestSession.id)
        if (persisted.length > 0) {
          // Re-inject the system message slot (rebuilt at send-time, blank for display purposes)
          chatMessages.value = [{ role: 'system', content: '' }, ...persisted]
          return
        }
      }
    }

    // No sessions or empty session: fresh start
    await _startFreshChat()
  }

  async function _startFreshChat() {
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

    if (usesSessionPersistence) {
      const sessionModel = await ensureSelectedChatModel()
      const newSessionId = await sessions.createSession(mode, sessionModel || '')
      if (newSessionId) {
        // Persist the initial assistant greeting
        const greetingMsg = chatMessages.value[1]
        if (greetingMsg) {
          await sessions.appendMessage(newSessionId, greetingMsg)
        }
      }
    }
  }

  /**
   * Helper to get a string version of a message's content for filtering/logging.
   */
  function contentAsString(content: string | ContentPart[]): string {
    if (typeof content === 'string') return content
    return content.map((p) => (p.type === 'text' ? p.text : '[image]')).join(' ')
  }

  async function buildApiContent(content: string | ContentPart[]): Promise<string | ContentPart[]> {
    if (!Array.isArray(content) || !import.meta.client) {
      return content
    }

    return await Promise.all(
      content.map(async (part) => {
        if (part.type !== 'image_url') {
          return part
        }

        return {
          ...part,
          image_url: {
            url: await resolveVisionImageUrl(part.image_url.url, window.location.origin),
          },
        }
      }),
    )
  }

  async function buildApiMessages(messages: ChatMessage[]) {
    const serialized = await Promise.all(
      messages.map(async (message) => ({
        role: message.role,
        content: await buildApiContent(message.content),
      })),
    )

    return serialized.filter((message) => contentAsString(message.content).trim().length > 0)
  }

  async function ensureSelectedChatModel(): Promise<string | null> {
    if (
      selectedModel.value &&
      (!chatModels.value.length || chatModels.value.includes(selectedModel.value))
    ) {
      return selectedModel.value
    }

    if (!chatModels.value.length) {
      await refreshModels()
    }

    const nextModel = preferredChatModel.value || chatModels.value[0] || null
    if (nextModel) {
      selectedModel.value = nextModel
    }

    return nextModel
  }

  async function resolveRequestModel(messages: ChatMessage[]): Promise<string> {
    if (payloadNeedsVision(messages)) {
      if (!chatModels.value.length) {
        await refreshModels()
      }

      let visionModel = preferredVisionModel.value
      if (!visionModel) {
        await refreshModels()
        visionModel = preferredVisionModel.value
      }

      if (!visionModel) {
        throw new Error('No vision-capable xAI chat model is available for this API key.')
      }

      return visionModel
    }

    const chatModel = await ensureSelectedChatModel()
    if (!chatModel) {
      throw new Error('No xAI chat model is available for this API key.')
    }

    return chatModel
  }

  async function sendChatMessage(contextString?: string) {
    if (!chatInput.value.trim() || isChatting.value) return

    const userText = chatInput.value
    chatInput.value = ''
    error.value = null

    const finalUserText = contextString
      ? `${userText}\n\nCURRENT UI STATE:\n${contextString}`
      : userText

    const userMessage: ChatMessage = { role: 'user', content: finalUserText }
    chatMessages.value.push(userMessage)
    isChatting.value = true

    let assistantIndex = -1

    try {
      await ensureTagsLoaded()

      const elementsContext = elements.value.length
        ? `The user has the following saved Prompt Elements in their library:\n${elements.value
            .map((e) => `- [${e.type}] "${e.name}": ${e.content}`)
            .join(
              '\n',
            )}\n\nMake sure to deeply reference or combine these if the user asks for them.`
        : 'The user has no saved Prompt Elements yet.'

      const modifiersContext = `\n\nThe app supports "Quick Modifiers" organized by attribute key. When suggesting modifications, emit attribute-value pairs in your <builder_state> JSON response using the attribute keys defined in the schema (e.g. {"hair_color": "blonde", "lighting": "golden hour"}).`
      const schemaContext = `\n\n${schemaToPromptContext()}`
      const pipelineContext = `\n\n${compilationPipelineDescription()}`

      let baseSystemPrompt = prompts.value[`chat_${chatMode.value}`]
      if (!baseSystemPrompt) {
        try {
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

      const payloadMessages = [...chatMessages.value]
      payloadMessages[0] = {
        role: 'system',
        content: `${baseSystemPrompt}${mediaContext}\n\n${elementsContext}${modifiersContext}${schemaContext}${pipelineContext}`,
      }

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

      const apiMessages = await buildApiMessages(payloadMessages)
      const requestModel = await resolveRequestModel(apiMessages)

      const res = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          chatMode: chatMode.value,
          model: requestModel,
          messages: apiMessages,
          stream: true,
        }),
      })

      if (!res.ok) throw new Error(`API Error (${res.status})`)

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

      if (usesSessionPersistence) {
        const sessionId = sessions.activeSessionId.value
        if (sessionId) {
          const assistantMsg = chatMessages.value[assistantIndex]
          // Extract session title from agent's suggested_name (first time only)
          const existingSession = sessions.sessions.value.find((s) => s.id === sessionId)
          const shouldSetTitle = !existingSession?.title && parsed.suggested_name
          await sessions.appendMessage(sessionId, userMessage)
          if (assistantMsg) {
            await sessions.appendMessage(
              sessionId,
              assistantMsg,
              shouldSetTitle ? parsed.suggested_name : undefined,
            )
          }
        }
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      const errorMsg = err.data?.message || err.message || 'Failed to get chat response'
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
    }
  }

  /**
   * Generate an image inline in the chat thread without navigating away.
   */
  async function generateInline(prompt: string) {
    if (generatingInline.value) return
    generatingInline.value = true
    error.value = null

    const placeholderMsg: ChatMessage = {
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
    }
    chatMessages.value.push(placeholderMsg)
    const placeholderIndex = chatMessages.value.length - 1

    try {
      const result = await $fetch<{ mediaUrl: string; id: string }>('/api/generate/image', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: { prompt },
      })

      const successMsg =
        "Here's your generated image. I've shared it back into the chat so I can confirm what I received."
      const msg = chatMessages.value[placeholderIndex]
      if (msg) {
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

      if (usesSessionPersistence) {
        const sessionId = sessions.activeSessionId.value
        const finalMsg = chatMessages.value[placeholderIndex]
        if (sessionId && finalMsg) {
          await sessions.appendMessage(sessionId, finalMsg)
        }
      }

      generatingInline.value = false
      await shareImageWithAgent(result.mediaUrl, INLINE_IMAGE_ACKNOWLEDGEMENT_PROMPT)
      return
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
   * Local/private media is inlined so the model can actually read it.
   */
  async function shareImageWithAgent(imageUrl: string, userComment?: string) {
    if (isChatting.value) return
    error.value = null

    const text =
      userComment?.trim() ||
      'Here is the generated image. What do you think? Can you suggest improvements or next steps?'
    const visionContent: ContentPart[] = [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageUrl } },
    ]

    const userMessage: ChatMessage = { role: 'user', content: visionContent }
    chatMessages.value.push(userMessage)
    isChatting.value = true

    let assistantIndex = -1

    try {
      await ensureTagsLoaded()

      const baseSystemPrompt = prompts.value[`chat_${chatMode.value}`] || ''
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

      const assistantPlaceholder: ChatMessage = {
        role: 'assistant',
        content: '',
        parsedResponse: {
          message: '',
          prompt: null,
          suggested_name: null,
          builder_state: null,
        },
      }
      chatMessages.value.push(assistantPlaceholder)
      assistantIndex = chatMessages.value.length - 1

      const apiMessages = await buildApiMessages(payloadMessages)
      const requestModel = await resolveRequestModel(apiMessages)

      const res = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          chatMode: chatMode.value,
          model: requestModel,
          messages: apiMessages,
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
            /* wait */
          }
        }

        const msg = chatMessages.value[assistantIndex]!
        msg.content = fullContent
        msg.parsedResponse = { ...parsed }
      }

      if (usesSessionPersistence) {
        const sessionId = sessions.activeSessionId.value
        if (sessionId) {
          const assistantMsg = chatMessages.value[assistantIndex]
          await sessions.appendMessage(sessionId, userMessage)
          if (assistantMsg) {
            await sessions.appendMessage(sessionId, assistantMsg)
          }
        }
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
    }
  }

  /**
   * Start a completely fresh chat session.
   */
  async function startNewChat() {
    chatMessages.value = []
    chatInput.value = ''
    error.value = null
    if (usesSessionPersistence) {
      sessions.activeSessionId.value = null
    }
    await _startFreshChat()
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
    sessions,
    initializeChat,
    sendChatMessage,
    generateInline,
    shareImageWithAgent,
    startNewChat,
  }
}
