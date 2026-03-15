import type { PresetType, PromptTag } from '~/types/promptTag'
import { parseContentToAttributes } from '~/utils/presetSchemas'
import { presetToProse, budgetAttributes } from '~/utils/presetProseTemplates'
import { lintPrompt, type PromptWarning } from '~/utils/promptLint'
import { AURORA_OPTIMAL_LENGTH } from '~/utils/promptLimits'

interface PresetBlock {
  type: PresetType
  content: string
}

/** Attribute keys stripped from preset content — non-visual metadata that bloats image prompts */
const EXCLUDED_ATTRIBUTE_KEYS = new Set(['name', 'description', 'extended_detail', 'other'])

/**
 * usePromptCompiler — deterministic prompt compilation.
 *
 * Provides two compilation modes:
 * 1. `compiledPrompt` — structured "Key: Value" format (kept for debug/edit view)
 * 2. `prosePrompt` — natural language prose optimized for Aurora
 *
 * The `compilePrompt()` function returns prose by default, since that is
 * what gets sent to the image generation API.
 *
 * Key rules (structured mode):
 * - Preset attribute lines are NEVER pruned — originals are kept if no tag matches
 * - Multi-select categories produce comma-joined snippets
 * - Matching uses (presetType, attributeKey) scoping via `appliesTo`
 *   so scene:lighting and style:lighting are disambiguated
 */
export function usePromptCompiler(deps: {
  prompt: Ref<string>
  activePresetBlocks: ComputedRef<PresetBlock[]>
  selectedTags: ComputedRef<PromptTag[]>
}) {
  const { prompt, activePresetBlocks, selectedTags } = deps

  /**
   * Check if a tag should apply to a given preset type's attribute line.
   * - If tag.appliesTo is null/empty → global tag, matches any preset type
   * - If tag.appliesTo is a list → only matches if presetType is included
   */
  function tagAppliesToPreset(tag: PromptTag, presetType: PresetType): boolean {
    if (!tag.appliesTo || tag.appliesTo.length === 0) return true
    return tag.appliesTo.includes(presetType)
  }

  // ─── Structured Compilation (existing, kept for debug view) ───

  /**
   * Compile the final prompt using structured "Key: Value" format.
   * [preset content with scoped tag substitutions] + [user prompt] + [unconsumed tags]
   */
  const compiledPrompt = computed(() => {
    const parts: string[] = []
    const usedTagIds = new Set<string>()

    // 1. Render preset attributes, substituting selected tags scoped by preset type
    for (const block of activePresetBlocks.value) {
      const lines = block.content
        .split('\n')
        .map((line) => {
          const colonIdx = line.indexOf(':')
          if (colonIdx <= 0) return line

          const key = line.slice(0, colonIdx).trim().toLowerCase().replaceAll(' ', '_')
          const value = line.slice(colonIdx + 1).trim()

          // Strip non-visual metadata lines (backstory, labels, filler)
          if (EXCLUDED_ATTRIBUTE_KEYS.has(key)) return null

          // Collect tags that match BOTH attributeKey AND appliesTo for this preset type
          const matchingTags = selectedTags.value.filter(
            (t) => t.attributeKey === key && tagAppliesToPreset(t, block.type),
          )
          if (matchingTags.length > 0) {
            for (const t of matchingTags) usedTagIds.add(t.id)
            const combined = matchingTags.map((t) => t.snippet).join(', ')
            // If all matched snippets are empty, drop the line entirely
            if (!combined.trim()) return null
            return `${line.slice(0, colonIdx + 1)} ${combined}`
          }

          // Drop lines with value "None" — they add noise without visual guidance
          if (value.toLowerCase() === 'none') return null

          // Keep original line
          return line
        })
        .filter((line): line is string => line !== null)
      parts.push(lines.join('\n'))
    }

    // 2. User prompt
    if (prompt.value.trim()) {
      parts.push(prompt.value.trim())
    }

    // 3. Unconsumed tags (global modifiers or tags that didn't match any preset attribute)
    const unconsumed = selectedTags.value.filter((t) => !usedTagIds.has(t.id)).map((t) => t.snippet)
    if (unconsumed.length) {
      parts.push(unconsumed.join(', '))
    }

    return parts.filter(Boolean).join('\n\n')
  })

  // ─── Prose Compilation (Aurora-optimized) ─────────────────────

  /**
   * Compile the final prompt as natural language prose.
   *
   * Pipeline:
   * 1. Parse each preset block's content → structured attributes
   * 2. Apply selected tag overrides (scoped by presetType + attributeKey)
   * 3. Convert to prose via presetToProse()
   * 4. Append user prompt text
   * 5. Append unconsumed tag snippets as natural modifiers
   * 6. Apply length budgeting if needed
   */
  const prosePrompt = computed(() => {
    const proseParts: string[] = []
    const usedTagIds = new Set<string>()

    for (const block of activePresetBlocks.value) {
      // Parse the structured "Key: Value" content to attributes
      const attrs = parseContentToAttributes(block.content)

      // Apply tag overrides: for each attribute key, if a matching tag exists, replace the value
      for (const tag of selectedTags.value) {
        if (
          tagAppliesToPreset(tag, block.type) &&
          tag.attributeKey in attrs &&
          tag.snippet.trim()
        ) {
          attrs[tag.attributeKey] = tag.snippet
          usedTagIds.add(tag.id)
        }
      }

      // Budget attributes if running long
      const estimatedLength = proseParts.join('. ').length + prompt.value.length
      const budgeted = budgetAttributes(attrs, estimatedLength, AURORA_OPTIMAL_LENGTH)

      // Convert to prose
      const prose = presetToProse(block.type, budgeted)
      if (prose) proseParts.push(prose)
    }

    // Assemble: join presets with ", " or ". " depending on type groupings
    let assembled = ''
    if (proseParts.length > 0) {
      assembled = proseParts.join('. ')
    }

    // Append user prompt
    if (prompt.value.trim()) {
      assembled = assembled ? `${assembled}. ${prompt.value.trim()}` : prompt.value.trim()
    }

    // Append unconsumed tags as natural modifiers
    const unconsumed = selectedTags.value
      .filter((t) => !usedTagIds.has(t.id))
      .map((t) => t.snippet)
      .filter(Boolean)
    if (unconsumed.length) {
      assembled = assembled ? `${assembled}. ${unconsumed.join(', ')}` : unconsumed.join(', ')
    }

    return assembled
  })

  // ─── Prompt Quality Signals ────────────────────────────────────

  const promptLength = computed(() => prosePrompt.value.length)

  const promptWarnings = computed<PromptWarning[]>(() => {
    return lintPrompt(prosePrompt.value)
  })

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Set builder context when a composed/library/parsed prompt activates presets.
   * Preset activation is handled by the caller (useGenerationForm) via activePresetIds.
   */
  function setBuilderContext(newPrompt: string, _presetContents: string[]) {
    prompt.value = newPrompt
  }

  return {
    // Structured compilation (debug/edit view)
    compiledPrompt,
    compileStructured: () => compiledPrompt.value,

    // Prose compilation (generation, Aurora-optimized)
    prosePrompt,
    compilePrompt: () => prosePrompt.value,

    // Quality signals
    promptLength,
    promptWarnings,

    // Builder context
    setBuilderContext,
  }
}
