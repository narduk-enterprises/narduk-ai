import type { Ref } from 'vue'
import type { ChatMessage, IterationRun } from '~/types/chat'

interface UseChatScrollOptions {
  chatMessages: Ref<ChatMessage[]>
  isChatting: Ref<boolean>
  isIterating?: Ref<boolean>
  generatingInline?: Ref<boolean>
  activeIterationRun?: Ref<IterationRun | null>
}

/**
 * Shared scroll-to-bottom logic for chat containers.
 * Handles auto-scroll on new messages, during streaming, and on state changes.
 */
export function useChatScroll(options: UseChatScrollOptions) {
  const chatScrollContainer = ref<HTMLElement | null>(null)

  function scrollToBottom() {
    nextTick(() => {
      if (chatScrollContainer.value) {
        chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight
      }
    })
  }

  // Auto-scroll during streaming: track last message content length
  const lastMessageContentLength = computed(() => {
    const msgs = options.chatMessages.value
    if (!msgs.length) return 0
    const last = msgs.at(-1)!
    const content = typeof last.content === 'string' ? last.content : ''
    return content.length + (last.parsedResponse?.message?.length ?? 0)
  })

  // Watchers — all unconditional per Vue composable rules
  watch(() => options.chatMessages.value.length, scrollToBottom)
  watch(options.isChatting, scrollToBottom)
  watch(lastMessageContentLength, scrollToBottom)
  watch(() => options.isIterating?.value, scrollToBottom)
  watch(() => options.generatingInline?.value, scrollToBottom)
  watch(() => options.activeIterationRun?.value?.completedIterations ?? 0, scrollToBottom)

  return { chatScrollContainer, scrollToBottom }
}
