import type {
  ChatMessage,
  ChatMode,
  ChatParsedResponse,
  ChatPersistenceMode,
  ContentPart,
  IterationRun,
} from '~/types/chat'
import { normalizeChatRequestMessages } from '~/utils/chatHistory'
import {
  buildIterationUserMessage,
  createIterationRun,
  deriveIterationSessionTitle,
  runIterationLoop,
} from '~/utils/iterationRun'
import { payloadNeedsVision, resolveVisionImageUrl } from '~/utils/visionImage'

type ChatInputMode = 'chat' | 'iterate'

interface UseChatFormOptions {
  persistence?: ChatPersistenceMode
  resumeMode?: ChatMode
}

interface StartIterationRunOptions {
  prompt?: string
  goal?: string
  round?: number
}

interface ApiChatMessage {
  role: ChatMessage['role']
  content: ChatMessage['content']
}

function createParsedResponse(overrides: Partial<ChatParsedResponse> = {}): ChatParsedResponse {
  return {
    message: '',
    prompt: null,
    suggested_name: null,
    continuation_summary: null,
    builder_state: null,
    imageUrl: null,
    isInlineGeneration: false,
    iterationRun: null,
    ...overrides,
  }
}

function formatAssistantContent(message: string): string {
  return message ? `<message>${message}</message>` : ''
}

function getIterationStatusMessage(run: IterationRun): string {
  if (run.status === 'completed') {
    return `Iteration round ${run.round} completed. Refined the prompt across ${run.completedIterations} passes.`
  }

  if (run.status === 'stopped') {
    return `Iteration round ${run.round} stopped after ${run.completedIterations} of ${run.totalIterations} passes.`
  }

  if (run.status === 'failed') {
    return `Iteration round ${run.round} failed after ${run.completedIterations} completed passes.`
  }

  if (run.steps.length === 0) {
    return `Starting iteration round ${run.round}.`
  }

  const latestStep = run.steps.at(-1)
  if (!latestStep) {
    return `Starting iteration round ${run.round}.`
  }

  return `Completed pass ${latestStep.iteration} of ${run.totalIterations}. ${latestStep.changeSummary}`
}

function createIterationParsedResponse(run: IterationRun): ChatParsedResponse {
  return createParsedResponse({
    message: getIterationStatusMessage(run),
    prompt: run.currentPrompt || run.initialPrompt,
    iterationRun: run,
  })
}

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
  const inputMode = ref<ChatInputMode>('chat')
  const iterationPrompt = ref('')
  const iterationGoal = ref('')
  const activeIterationRun = ref<IterationRun | null>(null)
  const isChatting = ref(false)
  const isIterating = ref(false)
  const generatingInline = ref(false)
  const error = ref<string | null>(null)
  const selectedModel = ref<string>('')
  let iterationAbortController: AbortController | null = null

  watchEffect(() => {
    if (!chatModels.value.length) return

    if (!selectedModel.value || !chatModels.value.includes(selectedModel.value)) {
      selectedModel.value = preferredChatModel.value || chatModels.value[0]!
    }
  })

  watch(chatMode, () => {
    if (isIterating.value) return

    chatMessages.value = []
    void initializeChat()
  })

  async function initializeChat() {
    if (usesSessionPersistence) {
      await sessions.fetchSessions()

      const latestSession = options.resumeMode
        ? sessions.sessions.value.find((session) => session.mode === options.resumeMode)
        : sessions.sessions.value[0]

      if (latestSession) {
        chatMode.value = (latestSession.mode as ChatMode) || 'general'
        selectedModel.value = latestSession.model || ''
        const persisted = await sessions.loadSession(latestSession.id)
        if (persisted.length > 0) {
          chatMessages.value = [{ role: 'system', content: '' }, ...persisted]
          return
        }
      }
    }

    await startFreshChat()
  }

  async function startFreshChat() {
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
        content: formatAssistantContent(initialMessage),
        parsedResponse: createParsedResponse({
          message: initialMessage,
        }),
      },
    ]

    if (usesSessionPersistence) {
      const sessionModel = await ensureSelectedChatModel()
      const newSessionId = await sessions.createSession(mode, sessionModel || '')
      if (newSessionId) {
        const greetingMessage = chatMessages.value[1]
        if (greetingMessage) {
          await sessions.appendMessage(newSessionId, greetingMessage)
        }
      }
    }
  }

  function contentAsString(content: string | ContentPart[]): string {
    if (typeof content === 'string') return content
    return content.map((part) => (part.type === 'text' ? part.text : '[image]')).join(' ')
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

  async function buildApiMessages(messages: ChatMessage[]): Promise<ApiChatMessage[]> {
    const serialized = await Promise.all(
      messages.map(async (message) => ({
        role: message.role,
        content: await buildApiContent(message.content),
      })),
    )

    return normalizeChatRequestMessages(
      serialized.filter((message) => contentAsString(message.content).trim().length > 0),
    )
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

  async function ensureVisionChatModel(): Promise<string | null> {
    if (!chatModels.value.length) {
      await refreshModels()
    }

    let visionModel = preferredVisionModel.value
    if (!visionModel) {
      await refreshModels()
      visionModel = preferredVisionModel.value
    }

    return visionModel
  }

  async function resolveRequestModel(messages: ApiChatMessage[]): Promise<string> {
    if (payloadNeedsVision(messages)) {
      const visionModel = await ensureVisionChatModel()
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

  async function ensureActiveSessionId(): Promise<string | null> {
    if (!usesSessionPersistence) return null
    if (sessions.activeSessionId.value) return sessions.activeSessionId.value

    const sessionModel = await ensureSelectedChatModel()
    return await sessions.createSession(chatMode.value, sessionModel || '')
  }

  async function requestImageGeneration(prompt: string, signal?: AbortSignal) {
    return await $fetch<{ mediaUrl: string; id: string }>('/api/generate/image', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { prompt },
      signal,
    })
  }

  async function resolveIterationReviewImageUrl(imageUrl: string) {
    if (!import.meta.client) return imageUrl

    return await resolveVisionImageUrl(imageUrl, window.location.origin)
  }

  async function persistTurn(
    userMessage: ChatMessage,
    assistantMessage: ChatMessage | undefined,
    sessionTitle?: string | null,
  ) {
    if (!usesSessionPersistence) return

    const sessionId = await ensureActiveSessionId()
    if (!sessionId) return

    await sessions.appendMessage(sessionId, userMessage)
    if (assistantMessage) {
      await sessions.appendMessage(sessionId, assistantMessage, sessionTitle || undefined)
    }
  }

  async function sendChatMessage(contextString?: string) {
    if (!chatInput.value.trim() || isChatting.value || isIterating.value) return

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
            .map((element) => `- [${element.type}] "${element.name}": ${element.content}`)
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
        } catch (fetchError) {
          console.error('Failed to load system prompts:', fetchError)
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
        parsedResponse: createParsedResponse(),
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
        const message = 'Sorry, the response was empty. Please try again.'
        const assistantMessage = chatMessages.value[assistantIndex]
        if (assistantMessage) {
          assistantMessage.content = formatAssistantContent(message)
          assistantMessage.parsedResponse = createParsedResponse({ message })
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const parsed = createParsedResponse()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })

        const messageMatch = fullContent.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
        const promptMatch = fullContent.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
        const titleMatch = fullContent.match(
          /<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i,
        )
        const summaryMatch = fullContent.match(
          /<continuation_summary>([\s\S]*?)(?:<\/continuation_summary>|$)/i,
        )
        const stateMatch = fullContent.match(/<builder_state>([\s\S]*?)(?:<\/builder_state>|$)/i)

        if (messageMatch?.[1]) parsed.message = messageMatch[1].trim()
        if (promptMatch?.[1]) parsed.prompt = promptMatch[1].trim()
        if (titleMatch?.[1]) parsed.suggested_name = titleMatch[1].trim()
        if (summaryMatch?.[1]) parsed.continuation_summary = summaryMatch[1].trim()
        if (stateMatch?.[1]) {
          try {
            parsed.builder_state = JSON.parse(stateMatch[1].trim())
          } catch {
            // Wait until the stream includes the full JSON object.
          }
        }

        const assistantMessage = chatMessages.value[assistantIndex]
        if (assistantMessage) {
          assistantMessage.content = fullContent
          assistantMessage.parsedResponse = { ...parsed }
        }
      }

      const assistantMessage = chatMessages.value[assistantIndex]
      const sessionId = sessions.activeSessionId.value
      const existingSession = sessionId
        ? sessions.sessions.value.find((session) => session.id === sessionId)
        : null
      const sessionTitle =
        !existingSession?.title && parsed.suggested_name ? parsed.suggested_name : undefined

      await persistTurn(userMessage, assistantMessage, sessionTitle)
    } catch (requestError) {
      const err = requestError as { data?: { message?: string }; message?: string }
      const errorMessage = err.data?.message || err.message || 'Failed to get chat response'
      error.value = errorMessage

      if (assistantIndex >= 0) {
        const assistantMessage = chatMessages.value[assistantIndex]
        if (assistantMessage) {
          assistantMessage.content = formatAssistantContent(errorMessage)
          assistantMessage.parsedResponse = createParsedResponse({
            message: `⚠️ ${errorMessage}`,
          })
        }
      }
    } finally {
      isChatting.value = false
    }
  }

  async function startIterationRun(optionsOverride: StartIterationRunOptions = {}) {
    if (isIterating.value || isChatting.value || generatingInline.value) return

    const startingPrompt = (optionsOverride.prompt ?? iterationPrompt.value).trim()
    const goal = (optionsOverride.goal ?? iterationGoal.value).trim()
    const round = optionsOverride.round ?? 1

    if (!startingPrompt || !goal) return

    inputMode.value = 'iterate'
    iterationPrompt.value = startingPrompt
    iterationGoal.value = goal
    error.value = null
    isIterating.value = true

    const userMessage: ChatMessage = {
      role: 'user',
      content: buildIterationUserMessage(startingPrompt, goal, round),
    }
    const initialRun = createIterationRun({
      initialPrompt: startingPrompt,
      goal,
      round,
    })

    chatMessages.value.push(userMessage)
    chatMessages.value.push({
      role: 'assistant',
      content: formatAssistantContent(getIterationStatusMessage(initialRun)),
      parsedResponse: createIterationParsedResponse(initialRun),
    })

    const assistantIndex = chatMessages.value.length - 1
    activeIterationRun.value = initialRun
    iterationAbortController = new AbortController()

    const updateIterationAssistant = (run: IterationRun) => {
      activeIterationRun.value = run

      const assistantMessage = chatMessages.value[assistantIndex]
      if (!assistantMessage) return

      assistantMessage.content = formatAssistantContent(getIterationStatusMessage(run))
      assistantMessage.parsedResponse = createIterationParsedResponse(run)
    }

    try {
      const requestModel = await ensureSelectedChatModel()
      if (!requestModel) {
        throw new Error('No xAI chat model is available for this API key.')
      }
      const visionModel = await ensureVisionChatModel()
      if (!visionModel) {
        throw new Error('No vision-capable xAI chat model is available for this API key.')
      }

      const run = await runIterationLoop({
        initialPrompt: startingPrompt,
        goal,
        round,
        signal: iterationAbortController.signal,
        onUpdate: updateIterationAssistant,
        runStep: async ({ prompt, goal, iteration, totalIterations, priorSteps, signal }) => {
          const stepResult = await $fetch<{
            revisedPrompt: string
            changeSummary: string
            message?: string | null
          }>('/api/chat/iterate-step', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: {
              prompt,
              goal,
              iteration,
              totalIterations,
              priorSteps,
              model: requestModel,
            },
            signal,
          })

          const generated = await requestImageGeneration(stepResult.revisedPrompt, signal)
          const imageUrl = await resolveIterationReviewImageUrl(generated.mediaUrl)

          const reviewResult = await $fetch<{
            revisedPrompt: string
            changeSummary: string
            message?: string | null
            imageAnalysis: string
          }>('/api/chat/iterate-review', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: {
              renderedPrompt: stepResult.revisedPrompt,
              goal,
              imageUrl,
              iteration,
              totalIterations,
              priorSteps,
              model: visionModel,
            },
            signal,
          })

          return {
            revisedPrompt: reviewResult.revisedPrompt,
            changeSummary: reviewResult.changeSummary,
            message: reviewResult.message || stepResult.message || null,
            renderedPrompt: stepResult.revisedPrompt,
            imageUrl: generated.mediaUrl,
            imageAnalysis: reviewResult.imageAnalysis,
          }
        },
      })

      iterationPrompt.value = run.currentPrompt

      const sessionId = sessions.activeSessionId.value
      const existingSession = sessionId
        ? sessions.sessions.value.find((session) => session.id === sessionId)
        : null
      const sessionTitle = !existingSession?.title ? deriveIterationSessionTitle(goal) : undefined

      await persistTurn(userMessage, chatMessages.value[assistantIndex], sessionTitle)
    } catch (requestError) {
      const err = requestError as { data?: { message?: string }; message?: string }
      const errorMessage = err.data?.message || err.message || 'Failed to run iterations'
      error.value = errorMessage

      const failedRun = activeIterationRun.value
        ? { ...activeIterationRun.value, status: 'failed' as const }
        : createIterationRun({ initialPrompt: startingPrompt, goal, round })
      updateIterationAssistant(failedRun)

      const assistantMessage = chatMessages.value[assistantIndex]
      if (assistantMessage?.parsedResponse) {
        assistantMessage.parsedResponse.message = `⚠️ ${errorMessage}`
        assistantMessage.content = formatAssistantContent(`⚠️ ${errorMessage}`)
      }

      await persistTurn(userMessage, assistantMessage)
    } finally {
      isIterating.value = false
      iterationAbortController = null
    }
  }

  function stopIterationRun() {
    if (!isIterating.value || !iterationAbortController) return

    iterationAbortController.abort()
  }

  async function continueIterationRun(run?: IterationRun) {
    const sourceRun = run ?? activeIterationRun.value
    if (!sourceRun || sourceRun.status === 'running') return

    iterationPrompt.value = sourceRun.currentPrompt
    iterationGoal.value = sourceRun.goal
    inputMode.value = 'iterate'

    await startIterationRun({
      prompt: sourceRun.currentPrompt,
      goal: sourceRun.goal,
      round: sourceRun.round + 1,
    })
  }

  async function generateInline(prompt: string) {
    if (generatingInline.value || isIterating.value) return
    generatingInline.value = true
    error.value = null

    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: formatAssistantContent('Generating image…'),
      parsedResponse: createParsedResponse({
        message: 'Generating image…',
        prompt,
        isInlineGeneration: true,
      }),
    }
    chatMessages.value.push(placeholderMessage)
    const placeholderIndex = chatMessages.value.length - 1

    try {
      const result = await requestImageGeneration(prompt)

      const successMessage =
        "Here's your generated image. Share it in chat if you want feedback or a prompt revision."
      const assistantMessage = chatMessages.value[placeholderIndex]
      if (assistantMessage) {
        assistantMessage.content = formatAssistantContent(successMessage)
        assistantMessage.parsedResponse = createParsedResponse({
          message: successMessage,
          prompt,
          imageUrl: result.mediaUrl,
          isInlineGeneration: true,
        })
      }

      const finalMessage = chatMessages.value[placeholderIndex]
      if (usesSessionPersistence) {
        const sessionId = sessions.activeSessionId.value
        if (sessionId && finalMessage) {
          await sessions.appendMessage(sessionId, finalMessage)
        }
      }
      return
    } catch (requestError) {
      const err = requestError as { data?: { message?: string }; message?: string }
      const errorMessage = err.data?.message || err.message || 'Image generation failed'
      error.value = errorMessage

      const assistantMessage = chatMessages.value[placeholderIndex]
      if (assistantMessage) {
        assistantMessage.content = formatAssistantContent(`⚠️ ${errorMessage}`)
        assistantMessage.parsedResponse = createParsedResponse({
          message: `⚠️ ${errorMessage}`,
          prompt,
          isInlineGeneration: true,
        })
      }
    } finally {
      generatingInline.value = false
    }
  }

  async function shareImageWithAgent(imageUrl: string, userComment?: string) {
    if (isChatting.value || isIterating.value) return
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
            .map((element) => `- [${element.type}] "${element.name}": ${element.content}`)
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
        parsedResponse: createParsedResponse(),
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
        console.warn('[useChatForm] res.body is null on vision turn')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const parsed = createParsedResponse()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })

        const messageMatch = fullContent.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
        const promptMatch = fullContent.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
        const titleMatch = fullContent.match(
          /<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i,
        )
        const summaryMatch = fullContent.match(
          /<continuation_summary>([\s\S]*?)(?:<\/continuation_summary>|$)/i,
        )
        const stateMatch = fullContent.match(/<builder_state>([\s\S]*?)(?:<\/builder_state>|$)/i)

        if (messageMatch?.[1]) parsed.message = messageMatch[1].trim()
        if (promptMatch?.[1]) parsed.prompt = promptMatch[1].trim()
        if (titleMatch?.[1]) parsed.suggested_name = titleMatch[1].trim()
        if (summaryMatch?.[1]) parsed.continuation_summary = summaryMatch[1].trim()
        if (stateMatch?.[1]) {
          try {
            parsed.builder_state = JSON.parse(stateMatch[1].trim())
          } catch {
            // Wait until the stream includes the full JSON object.
          }
        }

        const assistantMessage = chatMessages.value[assistantIndex]
        if (assistantMessage) {
          assistantMessage.content = fullContent
          assistantMessage.parsedResponse = { ...parsed }
        }
      }

      await persistTurn(userMessage, chatMessages.value[assistantIndex])
    } catch (requestError) {
      const err = requestError as { data?: { message?: string }; message?: string }
      const errorMessage = err.data?.message || err.message || 'Failed to get vision response'
      error.value = errorMessage
      if (assistantIndex >= 0) {
        const assistantMessage = chatMessages.value[assistantIndex]
        if (assistantMessage) {
          assistantMessage.content = formatAssistantContent(errorMessage)
          assistantMessage.parsedResponse = createParsedResponse({
            message: `⚠️ ${errorMessage}`,
          })
        }
      }
    } finally {
      isChatting.value = false
    }
  }

  async function startNewChat() {
    if (isIterating.value) return

    chatMessages.value = []
    chatInput.value = ''
    inputMode.value = 'chat'
    iterationPrompt.value = ''
    iterationGoal.value = ''
    activeIterationRun.value = null
    error.value = null
    if (usesSessionPersistence) {
      sessions.activeSessionId.value = null
    }
    await startFreshChat()
  }

  return {
    elements,
    fetchElements,
    chatMode,
    mediaType,
    chatMessages,
    chatInput,
    inputMode,
    iterationPrompt,
    iterationGoal,
    activeIterationRun,
    isChatting,
    isIterating,
    generatingInline,
    error,
    selectedModel,
    sessions,
    initializeChat,
    sendChatMessage,
    startIterationRun,
    stopIterationRun,
    continueIterationRun,
    generateInline,
    shareImageWithAgent,
    startNewChat,
  }
}
