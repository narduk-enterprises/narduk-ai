import type { ChatMessage, ChatMode } from '~/types/chat'
import { deserializePersistedChatMessage } from '~/utils/chatPersistence'

export interface ChatSession {
  id: string
  userId: string
  mode: ChatMode
  model: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface PersistedMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string // raw JSON string for multimodal, or plain text string
  parsedResponse: string | null // JSON string
  createdAt: string
}

/**
 * Manages creating, loading, and listing chat sessions in D1.
 * Does NOT own useChatForm state — it's a thin persistence adapter.
 */
export function useChatSessions() {
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)

  async function fetchSessions() {
    isLoadingSessions.value = true
    try {
      const data = await $fetch<ChatSession[]>('/api/chat/sessions', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      sessions.value = data
    } catch (e) {
      console.error('[useChatSessions] Failed to fetch sessions', e)
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function createSession(mode: ChatMode, model: string): Promise<string | null> {
    try {
      const result = await $fetch<{ id: string }>('/api/chat/sessions', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: { mode, model },
      })
      activeSessionId.value = result.id
      await fetchSessions()
      return result.id
    } catch (e) {
      console.error('[useChatSessions] Failed to create session', e)
      return null
    }
  }

  async function loadSession(sessionId: string): Promise<ChatMessage[]> {
    isLoadingMessages.value = true
    try {
      const data = await $fetch<{ session: ChatSession; messages: PersistedMessage[] }>(
        `/api/chat/${sessionId}/messages`,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
      )
      activeSessionId.value = sessionId

      return data.messages.map((message): ChatMessage => deserializePersistedChatMessage(message))
    } catch (e) {
      console.error('[useChatSessions] Failed to load session messages', e)
      return []
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function appendMessage(
    sessionId: string,
    message: ChatMessage,
    sessionTitle?: string | null,
  ) {
    try {
      await $fetch(`/api/chat/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: {
          role: message.role,
          content: message.content,
          parsedResponse: message.parsedResponse || undefined,
          ...(sessionTitle ? { sessionTitle } : {}),
        },
      })
    } catch (e) {
      console.error('[useChatSessions] Failed to append message', e)
    }
  }

  return {
    sessions,
    activeSessionId,
    isLoadingSessions,
    isLoadingMessages,
    fetchSessions,
    createSession,
    loadSession,
    appendMessage,
  }
}
