import type { ChatMessage, ChatParsedResponse } from '~/types/chat'

export interface PersistedChatMessageRecord {
  role: 'user' | 'assistant'
  content: string
  parsedResponse: string | null
}

export function deserializePersistedChatMessage(record: PersistedChatMessageRecord): ChatMessage {
  let parsedContent: ChatMessage['content']
  try {
    const parsed = JSON.parse(record.content)
    parsedContent = Array.isArray(parsed) ? parsed : record.content
  } catch {
    parsedContent = record.content
  }

  let parsedResponse: ChatParsedResponse | undefined
  if (record.parsedResponse) {
    try {
      parsedResponse = JSON.parse(record.parsedResponse) as ChatParsedResponse
    } catch {
      parsedResponse = undefined
    }
  }

  return {
    role: record.role,
    content: parsedContent,
    parsedResponse,
  }
}
