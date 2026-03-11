/**
 * usePromptParser — Client-side deterministic prompt parser.
 *
 * Parses raw "Key: value" formatted prompts into structured components
 * using the PRESET_ATTRIBUTES schema registry and Quick Modifiers list.
 * No LLM call needed — instant, accurate, and offline-capable.
 */
import { PRESET_ATTRIBUTES, parseContentToAttributes } from '~/utils/presetSchemas'
import type { QuickModifier } from './useQuickModifiers'

export interface ParsedPromptResult {
  type: string
  attributes: Record<string, string>
  matchedModifierIds: string[]
  remainingPrompt: string
}

/**
 * Deterministically parse a raw prompt into structured attributes + matched modifiers.
 * Works entirely client-side — no API call needed.
 */
function parsePromptSync(prompt: string, modifiers: QuickModifier[]): ParsedPromptResult {
  // 1. Parse "Key: value" lines into a flat attribute map
  const parsed = parseContentToAttributes(prompt)
  const parsedKeys = new Set(Object.keys(parsed))

  // 2. Determine best-matching preset type by counting attribute key overlaps
  let bestType = 'mixed'
  let bestScore = 0
  for (const [type, keys] of Object.entries(PRESET_ATTRIBUTES)) {
    const score = (keys as readonly string[]).filter((k) => parsedKeys.has(k)).length
    if (score > bestScore) {
      bestScore = score
      bestType = type
    }
  }

  // 3. Extract attributes that match the winning schema
  const schemaKeys = PRESET_ATTRIBUTES[bestType] ?? []
  const attributes: Record<string, string> = {}
  const consumedKeys = new Set<string>()

  for (const key of schemaKeys as readonly string[]) {
    if (parsed[key]) {
      attributes[key] = parsed[key]!
      consumedKeys.add(key)
    }
  }

  // Also grab any parsed keys NOT in the schema (extras)
  for (const [key, val] of Object.entries(parsed)) {
    if (!consumedKeys.has(key) && val) {
      attributes[key] = val
      consumedKeys.add(key)
    }
  }

  // 4. Match Quick Modifiers by checking if snippet text appears in the prompt
  const promptLower = prompt.toLowerCase()
  const matchedModifierIds: string[] = []

  for (const mod of modifiers) {
    const snippetLower = mod.snippet.toLowerCase()
    const labelLower = mod.label.toLowerCase()

    // Match if the modifier's snippet or label appears in the prompt
    if (promptLower.includes(snippetLower) || promptLower.includes(labelLower)) {
      matchedModifierIds.push(mod.id)
    }
  }

  // 5. Build remaining prompt from lines that weren't parsed as "Key: value"
  const remainingLines: string[] = []
  for (const line of prompt.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase().replaceAll(' ', '_')
      if (consumedKeys.has(key)) continue // Already extracted
    }
    const trimmed = line.trim()
    if (trimmed) remainingLines.push(trimmed)
  }

  return {
    type: bestScore > 0 ? bestType : 'mixed',
    attributes,
    matchedModifierIds,
    remainingPrompt: remainingLines.join('\n'),
  }
}

export function usePromptParser() {
  const { allModifiersList } = useQuickModifiers()
  const parsing = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<ParsedPromptResult | null>(null)

  /**
   * Parse a raw prompt string into structured components.
   * Runs entirely client-side — instant results.
   */
  function parsePrompt(prompt: string): ParsedPromptResult | null {
    if (!prompt.trim()) return null

    parsing.value = true
    error.value = null

    try {
      const result = parsePromptSync(prompt, allModifiersList.value)
      lastResult.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to parse prompt'
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
