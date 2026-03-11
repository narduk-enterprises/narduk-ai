export interface QuickModifier {
  id: string
  category: string
  label: string
  snippet: string
  sortOrder: number
  enabled: number
  usageCount: number
  updatedAt: string
}

export interface QuickModifierCategory {
  category: string
  label: string
  icon: string
  modifiers: QuickModifier[]
}

export function useQuickModifiers() {
  const categories = ref<QuickModifierCategory[]>([])
  const dynamicCategory = ref<QuickModifierCategory | null>(null)
  const selectedIds = ref<Set<string>>(new Set())
  const loading = ref(false)
  const searchQuery = ref('')

  const allCategories = computed(() => {
    return dynamicCategory.value ? [dynamicCategory.value, ...categories.value] : categories.value
  })

  const filteredModifiers = computed(() => {
    if (!searchQuery.value.trim()) return []
    const q = searchQuery.value.toLowerCase().trim()
    return allModifiersList.value.filter(
      (m) => m.label.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q),
    )
  })

  async function fetchModifiers() {
    loading.value = true
    try {
      const data = await $fetch<QuickModifierCategory[]>('/api/quick-modifiers')
      categories.value = data
    } catch (e) {
      console.error('Failed to load quick modifiers', e)
    } finally {
      loading.value = false
    }
  }

  function toggleModifier(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selectedIds.value = next
  }

  function isSelected(id: string) {
    return selectedIds.value.has(id)
  }

  function clearModifiers() {
    selectedIds.value = new Set()
  }

  /**
   * Compile selected modifier snippets into a single string.
   * Returns empty string if nothing is selected.
   */
  const compiledSnippets = computed(() => {
    if (!selectedIds.value.size) return ''
    const snippets: string[] = []
    for (const cat of allCategories.value) {
      for (const mod of cat.modifiers) {
        if (selectedIds.value.has(mod.id)) {
          snippets.push(mod.snippet)
        }
      }
    }
    return snippets.join(', ')
  })

  const selectedModifiersList = computed(() => {
    const list: QuickModifier[] = []
    for (const cat of allCategories.value) {
      for (const mod of cat.modifiers) {
        if (selectedIds.value.has(mod.id)) {
          list.push(mod)
        }
      }
    }
    return list
  })

  async function recordUsage(ids: string[]) {
    if (!ids.length) return
    try {
      await $fetch('/api/quick-modifiers/usage', {
        method: 'POST',
        body: { modifierIds: ids },
      })
    } catch (e) {
      console.error('Failed to record quick modifier usage', e)
    }
  }

  const allModifiersList = computed(() => {
    const list: QuickModifier[] = []
    for (const cat of allCategories.value) {
      list.push(...cat.modifiers)
    }
    return list
  })

  function addModifiers(ids: string[]) {
    const next = new Set(selectedIds.value)
    for (const id of ids) {
      next.add(id)
    }
    selectedIds.value = next
  }

  function setDynamicModifiers(modifiers: QuickModifier[]) {
    if (modifiers.length === 0) {
      dynamicCategory.value = null
      return
    }
    dynamicCategory.value = {
      category: 'preset-attributes',
      label: 'Preset Attributes',
      icon: 'i-lucide-list',
      modifiers,
    }
  }

  return {
    categories: allCategories, // export the computed allCategories as categories to smoothly drop into the UI
    dynamicCategory,
    selectedIds,
    loading,
    fetchModifiers,
    toggleModifier,
    isSelected,
    clearModifiers,
    compiledSnippets,
    selectedModifiersList,
    allModifiersList,
    addModifiers,
    setDynamicModifiers,
    recordUsage,
    searchQuery,
    filteredModifiers,
  }
}
