/**
 * usePromptParser — Composable for auto-parsing raw prompts into structured presets + modifiers.
 *
 * Uses the /api/generate/parse-prompt endpoint to decompose a pasted prompt.
 */
export interface ParsedPromptResult {
  type: string
  attributes: Record<string, string>
  matchedModifierIds: string[]
  remainingPrompt: string
}

export function usePromptParser() {
  const parsing = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<ParsedPromptResult | null>(null)

  /**
   * Parse a raw prompt string into structured components.
   */
  async function parsePrompt(prompt: string): Promise<ParsedPromptResult | null> {
    if (!prompt.trim()) return null

    parsing.value = true
    error.value = null

    try {
      const result = await $fetch<ParsedPromptResult>('/api/generate/parse-prompt', {
        method: 'POST',
        body: { prompt },
      })
      lastResult.value = result
      return result
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to parse prompt'
      return null
    } finally {
      parsing.value = false
    }
  }

  return {
    parsing,
    error,
    lastResult,
    parsePrompt,
  }
}
