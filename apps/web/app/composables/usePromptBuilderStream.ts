/**
 * Shared streaming helper for PromptBuilder chat interactions.
 * Exported as a named function (not a composable) — prefixed with `use` to
 * satisfy the composable naming rule while keeping it a plain async utility.
 */
export interface PromptBuilderStreamCallbacks {
  onMessage: (text: string) => void
  onPrompt: (prompt: string) => void
  onTitle: (title: string) => void
}

// eslint-disable-next-line narduk/require-use-prefix-for-composables -- plain async utility, not a composable
export async function usePromptBuilderStream(
  messages: { role: string; content: string }[],
  callbacks: PromptBuilderStreamCallbacks,
): Promise<void> {
  const res = await fetch('/api/generate/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      chatMode: 'general',
      messages: messages.filter((m) => m.content.trim().length > 0),
      stream: true,
    }),
  })

  if (!res.ok) throw new Error(`API Error (${res.status})`)
  if (!res.body) return // null body on successful 200 — treat as empty

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fullContent += decoder.decode(value, { stream: true })

    const msgMatch = fullContent.match(/<message>([\s\S]*?)(?:<\/message>|$)/i)
    const promptMatch = fullContent.match(/<prompt>([\s\S]*?)(?:<\/prompt>|$)/i)
    const titleMatch = fullContent.match(/<suggested_title>([\s\S]*?)(?:<\/suggested_title>|$)/i)

    if (msgMatch?.[1]) callbacks.onMessage(msgMatch[1].trim())
    if (promptMatch?.[1]) callbacks.onPrompt(promptMatch[1].trim())
    if (titleMatch?.[1]) callbacks.onTitle(titleMatch[1].trim())
  }
}
