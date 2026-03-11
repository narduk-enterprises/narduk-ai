import type { PromptElement } from './usePromptElements'
import type { QuickModifier } from './useQuickModifiers'

/**
 * usePromptCompiler — compiles the final prompt from presets, user text,
 * and modifier snippets. Also handles auto-matching preset attributes to
 * quick modifiers and dynamic modifier creation.
 */
export function usePromptCompiler(deps: {
  prompt: Ref<string>
  activePromptElements: Ref<string[]>
  activePresets: Ref<Record<string, string>>
  activeUserPromptId: Ref<string | null>
  attachedPerson: Ref<PromptElement | null>
  activeModifiers: Ref<QuickModifier[]>
}) {
  const {
    prompt,
    activePromptElements,
    activePresets,
    activeUserPromptId,
    attachedPerson,
    activeModifiers,
  } = deps

  // We need to receive the full list of modifiers from the page to do the matching
  const modifierCategoriesList = ref<QuickModifier[]>([])

  let onSelectModifiers: ((ids: string[]) => void) | undefined
  let onSetDynamicModifiers: ((mods: QuickModifier[]) => void) | undefined

  function setModifierDependencies(
    allModifiers: QuickModifier[],
    onSelect: (ids: string[]) => void,
    onSetDynamic?: (mods: QuickModifier[]) => void,
  ) {
    modifierCategoriesList.value = allModifiers
    onSelectModifiers = onSelect
    onSetDynamicModifiers = onSetDynamic
  }

  function setBuilderContext(
    newPrompt: string,
    presets: Record<string, string>,
    promptId?: string,
  ) {
    prompt.value = newPrompt
    activePromptElements.value = Object.values(presets).filter(Boolean) as string[]
    activePresets.value = presets
    activeUserPromptId.value = promptId || null

    // Auto-select modifiers for all loaded presets
    const accumulatedDynamicMods: QuickModifier[] = []
    const accumulatedSelect = new Set<string>()

    for (const content of activePromptElements.value) {
      autoSelectModifiersForPreset(content, accumulatedDynamicMods, accumulatedSelect)
    }

    if (onSetDynamicModifiers) {
      onSetDynamicModifiers(accumulatedDynamicMods)
    }
    if (onSelectModifiers && accumulatedSelect.size > 0) {
      onSelectModifiers(Array.from(accumulatedSelect))
    }
  }

  function autoSelectModifiersForPreset(
    content: string,
    accumulatedDynamicMods?: QuickModifier[],
    accumulatedSelect?: Set<string>,
  ) {
    const lines = content.split('\n')
    const modifiersToSelect = accumulatedSelect ?? new Set<string>()
    const dynamicModsToAdd: QuickModifier[] = accumulatedDynamicMods ?? []

    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx !== -1) {
        const key = line.slice(0, idx).trim().toLowerCase().replaceAll('-', ' ')
        const val = line
          .slice(idx + 1)
          .trim()
          .toLowerCase()

        const categoryMods = modifierCategoriesList.value.filter((m) => {
          const modCat = m.category.toLowerCase().replaceAll('-', ' ')
          return modCat === key || modCat === key.replaceAll(/\s+/g, '')
        })

        let matchedAny = false

        for (const mod of categoryMods) {
          const labelLower = mod.label.toLowerCase()
          const snippetLower = mod.snippet.toLowerCase()
          let matches = false

          if (key === 'age') {
            const ageNum = Number.parseInt(val)
            if (!Number.isNaN(ageNum)) {
              if (ageNum < 13 && mod.id === 'age-child') matches = true
              else if (ageNum >= 13 && ageNum < 20 && mod.id === 'age-teen') matches = true
              else if (ageNum >= 20 && ageNum < 30 && mod.id === 'age-20s') matches = true
              else if (ageNum >= 30 && ageNum < 40 && mod.id === 'age-30s') matches = true
              else if (ageNum >= 40 && ageNum < 50 && mod.id === 'age-40s') matches = true
              else if (ageNum >= 50 && ageNum < 60 && mod.id === 'age-50s') matches = true
              else if (ageNum >= 60 && mod.id === 'age-senior') matches = true
            } else if (val.includes(labelLower) || snippetLower.includes(val)) {
              matches = true
            }
          } else {
            // Match strategies (strictest first):
            // 1. Exact label match
            // 2. Label is contained in the preset value (e.g. "bouncy" in "natural & bouncy")
            // 3. Full preset value is contained in label (e.g. "medium" matches "Medium")
            // We intentionally do NOT word-split and match against snippets, because
            // common words like "natural" appear in many snippets and cause false positives.
            if (val === labelLower || val.includes(labelLower) || labelLower.includes(val)) {
              matches = true
            }
          }

          if (matches) {
            modifiersToSelect.add(mod.id)
            matchedAny = true
          }
        }

        if (!matchedAny) {
          // Attribute didn't match any pre-defined Quick Modifier category
          // Let's create a dynamic modifier for it!
          const dynamicId = 'dynamic-' + key.replaceAll(/\s+/g, '-')
          dynamicModsToAdd.push({
            id: dynamicId,
            category: key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            snippet: val,
            sortOrder: 0,
            enabled: 1,
            usageCount: 0,
            updatedAt: new Date().toISOString(),
          })
          modifiersToSelect.add(dynamicId)
        }
      }
    }

    // Only commit if we are not accumulating
    if (!accumulatedDynamicMods && onSetDynamicModifiers) {
      onSetDynamicModifiers(dynamicModsToAdd)
    }

    // Only commit if we are not accumulating
    if (
      !accumulatedSelect &&
      modifiersToSelect.size > 0 &&
      typeof onSelectModifiers !== 'undefined'
    ) {
      onSelectModifiers(Array.from(modifiersToSelect))
    }
  }

  /**
   * Compile the final prompt: [all active preset content] + [user prompt] + [unconsumed modifier snippets]
   */
  function compilePrompt(): string {
    const parts: string[] = []
    const unconsumedSnippets: string[] = []
    const consumedCategories = new Set<string>()

    // Combine all active preset contents (which may include the attached person)
    const presetLines: string[] = []
    if (activePromptElements.value && activePromptElements.value.length > 0) {
      for (const content of activePromptElements.value) {
        presetLines.push(...content.split('\n'))
      }
    }

    // Also include attachedPerson if it exists (legacy compatibility)
    if (
      attachedPerson.value &&
      !activePromptElements.value.includes(attachedPerson.value.content)
    ) {
      presetLines.push(...attachedPerson.value.content.split('\n'))
    }

    if (presetLines.length > 0) {
      const outLines = presetLines
        .map((line) => {
          // Use indexOf to safely parse attributes without regex backtracking
          const idx = line.indexOf(':')
          if (idx !== -1) {
            const key = line.slice(0, idx).trim().toLowerCase()

            // Normalize key for matching (e.g. "body type" -> "body type")
            const normalizedKey = key.replaceAll('-', ' ')

            // Find an active modifier matching this attribute key
            const modifier = activeModifiers.value.find((m) => {
              const cat = m.category.toLowerCase().replaceAll('-', ' ')
              return cat === normalizedKey || cat === key.replaceAll(/\s+/g, '')
            })

            if (modifier) {
              consumedCategories.add(modifier.category)
              return `${line.slice(0, idx)}: ${modifier.snippet}`
            }

            // A better way is to rely on a passed-in list of categories, but since useQuickModifiers
            // has all modifiers, we can assume if it's a known preset attribute, we want it pruned
            // if no modifier is active.
            // Let's implement the simpler rule: if it looks like a standard preset attribute
            // and we didn't explicitly select a modifier for it, PRUNE it to allow the base prompt to shine.
            const isRecognizedCategory = modifierCategoriesList.value.some((m) => {
              const cat = m.category.toLowerCase().replaceAll('-', ' ')
              return cat === normalizedKey || cat === key.replaceAll(/\s+/g, '')
            })

            if (isRecognizedCategory) {
              return null // Prune it because no modifier is active for this recognized category
            } else {
              return line // Keep it because it's not a quick modifier category
            }
          }
          return line
        })
        .filter((line): line is string => line !== null)

      for (const m of activeModifiers.value) {
        if (!consumedCategories.has(m.category)) {
          unconsumedSnippets.push(m.snippet)
        }
      }

      parts.push(outLines.join('\n'))
    } else {
      unconsumedSnippets.push(...activeModifiers.value.map((m) => m.snippet))
    }

    parts.push(prompt.value.trim())

    if (unconsumedSnippets.length) {
      parts.push(unconsumedSnippets.join(', '))
    }

    return parts.filter(Boolean).join('\n\n')
  }

  const compiledPrompt = computed(() => compilePrompt())

  return {
    setBuilderContext,
    setModifierDependencies,
    autoSelectModifiersForPreset,
    compilePrompt,
    compiledPrompt,
    onSetDynamicModifiers: () => onSetDynamicModifiers,
  }
}
