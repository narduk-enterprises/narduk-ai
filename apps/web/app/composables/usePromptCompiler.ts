import type { PresetType, PromptTag } from '~/types/promptTag'

interface PresetBlock {
  type: PresetType
  content: string
}

/**
 * usePromptCompiler — deterministic prompt compilation.
 *
 * Assembles the final prompt from:
 * 1. Active preset blocks (type + content, resolved from IDs)
 * 2. Selected prompt tags (substituted into matching preset attribute lines)
 * 3. User-written prompt text
 * 4. Unconsumed tags (appended as comma-separated snippets)
 *
 * Key rules:
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

  /**
   * Compile the final prompt:
   * [preset content with scoped tag substitutions] + [user prompt] + [unconsumed tags]
   */
  const compiledPrompt = computed(() => {
    const parts: string[] = []
    const usedTagIds = new Set<string>()

    // 1. Render preset attributes, substituting selected tags scoped by preset type
    for (const block of activePresetBlocks.value) {
      const lines = block.content.split('\n').map((line) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx <= 0) return line

        const key = line.slice(0, colonIdx).trim().toLowerCase().replaceAll(' ', '_')

        // Collect tags that match BOTH attributeKey AND appliesTo for this preset type
        const matchingTags = selectedTags.value.filter(
          (t) => t.attributeKey === key && tagAppliesToPreset(t, block.type),
        )
        if (matchingTags.length > 0) {
          for (const t of matchingTags) usedTagIds.add(t.id)
          const combined = matchingTags.map((t) => t.snippet).join(', ')
          return `${line.slice(0, colonIdx + 1)} ${combined}`
        }

        // Keep original line — NEVER prune
        return line
      })
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

  /**
   * Set builder context when a composed/library/parsed prompt activates presets.
   * Preset activation is handled by the caller (useGenerationForm) via activePresetIds.
   */
  function setBuilderContext(newPrompt: string, _presetContents: string[]) {
    prompt.value = newPrompt
  }

  return {
    compiledPrompt,
    compilePrompt: () => compiledPrompt.value,
    setBuilderContext,
  }
}
