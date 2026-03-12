export interface ChatRequestMessage<TContent = unknown> {
  role: string
  content: TContent
}

export const MAX_CHAT_MODEL_MESSAGES = 50

export function normalizeChatRequestMessages<T extends ChatRequestMessage>(
  messages: T[],
  maxMessages = MAX_CHAT_MODEL_MESSAGES,
): T[] {
  if (messages.length <= maxMessages) {
    return messages
  }

  const firstSystemIndex = messages.findIndex((message) => message.role === 'system')
  const firstSystemMessage = firstSystemIndex >= 0 ? messages[firstSystemIndex] : null
  const nonSystemMessages = messages.filter((_, index) => index !== firstSystemIndex)
  const availableSlots = Math.max(maxMessages - (firstSystemMessage ? 1 : 0), 0)
  const newestMessages = nonSystemMessages.slice(-availableSlots)

  return firstSystemMessage ? [firstSystemMessage, ...newestMessages] : newestMessages
}
