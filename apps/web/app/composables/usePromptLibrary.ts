/**
 * usePromptLibrary — manages the user's saved prompts and recipes.
 *
 * v2: Enhanced with recipe support — prompts can now include a templateId,
 * preset map (slot → elementId), and modifier IDs for full composition recall.
 */

export interface UserPrompt {
  id: string
  userId: string
  title: string
  prompt: string
  initialPresets?: string | null
  chatHistory?: string | null
  // Recipe fields
  templateId?: string | null
  presetMap?: string | null // JSON: Record<string, string>
  modifierIds?: string | null // JSON: string[]
  createdAt: string
  updatedAt: string
}

/** Parsed recipe data from a UserPrompt */
export interface RecipeData {
  templateId: string | null
  presetMap: Record<string, string> // slotType → elementId
  modifierIds: string[]
}

export function usePromptLibrary() {
  const prompts = ref<UserPrompt[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPrompts() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<UserPrompt[]>('/api/prompts')
      prompts.value = data
    } catch (e) {
      error.value = (e as { message?: string }).message || 'Failed to load prompts'
    } finally {
      loading.value = false
    }
  }

  async function savePrompt(
    title: string,
    prompt: string,
    initialPresets?: string | null,
    chatHistory?: string | null,
    recipe?: {
      templateId?: string | null
      presetMap?: Record<string, string>
      modifierIds?: string[]
    },
  ) {
    loading.value = true
    error.value = null
    try {
      const el = await $fetch<UserPrompt>('/api/prompts', {
        method: 'POST',
        body: {
          title,
          prompt,
          initialPresets,
          chatHistory,
          templateId: recipe?.templateId ?? null,
          presetMap: recipe?.presetMap ? JSON.stringify(recipe.presetMap) : null,
          modifierIds: recipe?.modifierIds?.length ? JSON.stringify(recipe.modifierIds) : null,
        },
      })
      prompts.value.unshift(el)
      return el
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to save prompt'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePrompt(id: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/prompts/${id}`, { method: 'DELETE' })
      prompts.value = prompts.value.filter((e) => e.id !== id)
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to delete prompt'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Parse recipe data from a UserPrompt.
   * Returns structured recipe info for loading into the generation form.
   */
  function parseRecipe(prompt: UserPrompt): RecipeData {
    let presetMap: Record<string, string> = {}
    let modifierIds: string[] = []

    if (prompt.presetMap) {
      try {
        presetMap = JSON.parse(prompt.presetMap)
      } catch {
        /* ignore */
      }
    }
    if (prompt.modifierIds) {
      try {
        modifierIds = JSON.parse(prompt.modifierIds)
      } catch {
        /* ignore */
      }
    }

    return {
      templateId: prompt.templateId ?? null,
      presetMap,
      modifierIds,
    }
  }

  /**
   * Check if a prompt has recipe data attached.
   */
  function isRecipe(prompt: UserPrompt): boolean {
    return !!(prompt.templateId || prompt.presetMap || prompt.modifierIds)
  }

  const recipes = computed(() => prompts.value.filter(isRecipe))
  const plainPrompts = computed(() => prompts.value.filter((p) => !isRecipe(p)))

  return {
    prompts,
    recipes,
    plainPrompts,
    loading,
    error,
    fetchPrompts,
    savePrompt,
    deletePrompt,
    parseRecipe,
    isRecipe,
  }
}
