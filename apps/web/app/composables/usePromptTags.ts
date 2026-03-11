import type { PromptTag, PromptTagCategory, PresetType } from '~/types/promptTag'

/**
 * Singleton composable for prompt tags (Quick Modifiers v2).
 *
 * Catalog is shared via useState() — all consumers see the same fetched data.
 * Selection state is local (ref) — ephemeral, owned by the generation form.
 */
export function usePromptTags() {
  // ─── Shared catalog (singleton via useState) ───────────────
  const tagCatalog = useState<PromptTagCategory[]>('prompt-tag-catalog', () => [])
  const catalogLoaded = useState<boolean>('prompt-tag-loaded', () => false)

  // ─── Local selection state (ephemeral, per consumer) ───────
  const selectedTagIds = ref<string[]>([])
  const searchQuery = ref('')

  // ─── Computed derivatives ──────────────────────────────────

  const allTagsList = computed<PromptTag[]>(() => {
    const list: PromptTag[] = []
    for (const cat of tagCatalog.value) {
      for (const t of cat.tags) {
        list.push(t)
      }
    }
    return list
  })

  const selectedTagsList = computed<PromptTag[]>(() => {
    const idSet = new Set(selectedTagIds.value)
    return allTagsList.value.filter((t) => idSet.has(t.id))
  })

  const filteredTags = computed<PromptTag[]>(() => {
    if (!searchQuery.value.trim()) return []
    const q = searchQuery.value.toLowerCase().trim()
    return allTagsList.value.filter(
      (t) => t.label.toLowerCase().includes(q) || t.snippet.toLowerCase().includes(q),
    )
  })

  const compiledSnippets = computed(() => {
    if (!selectedTagIds.value.length) return ''
    return selectedTagsList.value.map((t) => t.snippet).join(', ')
  })

  // ─── Load gate ─────────────────────────────────────────────

  async function ensureLoaded() {
    if (catalogLoaded.value) return
    await fetchTags()
  }

  async function fetchTags() {
    try {
      const data = await $fetch<PromptTagCategory[]>('/api/quick-modifiers')

      // Transform server response (QuickModifiersByCategory) → PromptTagCategory
      type RawCategory = Record<string, unknown>
      type RawModifier = Record<string, unknown>
      tagCatalog.value = data.map((cat) => {
        const raw = cat as unknown as RawCategory
        const modifiers = (raw.modifiers ?? raw.tags ?? []) as RawModifier[]
        return {
          attributeKey: (raw.attributeKey as string) || cat.attributeKey,
          appliesTo: (raw.appliesTo as PresetType[] | null) || null,
          selectionMode: ((raw.selectionMode as string) || 'single') as 'single' | 'multi',
          label: cat.label,
          icon: (raw.icon as string) || 'i-lucide-tag',
          tags: modifiers.map((m) => ({
            id: m.id as string,
            category: m.category as string,
            attributeKey:
              (m.attributeKey as string) || (m.attribute_key as string) || (m.category as string),
            appliesTo: parseAppliesTo(m.appliesTo || m.applies_to),
            selectionMode: ((m.selectionMode as string) || (m.selection_mode as string) || 'single') as 'single' | 'multi',
            label: m.label as string,
            snippet: m.snippet as string,
            sortOrder: (m.sortOrder as number) || (m.sort_order as number) || 0,
            enabled: (m.enabled as number) ?? 1,
            usageCount: (m.usageCount as number) || (m.usage_count as number) || 0,
            updatedAt: (m.updatedAt as string) || (m.updated_at as string) || '',
          })),
        }
      })
      catalogLoaded.value = true
    } catch (e) {
      console.error('Failed to load prompt tags', e)
    }
  }

  // ─── Selection actions ─────────────────────────────────────

  function toggleTag(id: string) {
    const tag = allTagsList.value.find((t) => t.id === id)
    if (!tag) return

    const idx = selectedTagIds.value.indexOf(id)
    if (idx >= 0) {
      // Deselect
      selectedTagIds.value = selectedTagIds.value.filter((i) => i !== id)
      return
    }

    // Enforce single-select per (attributeKey, appliesTo) scope for 'single' mode categories.
    // This means scene:lighting and style:lighting are independent slots —
    // selecting a scene lighting tag doesn't evict a style lighting tag.
    if (tag.selectionMode === 'single') {
      const tagScope = JSON.stringify(tag.appliesTo?.sort() ?? [])
      const sameSlotSiblings = allTagsList.value
        .filter((t) => {
          if (t.attributeKey !== tag.attributeKey) return false
          const tScope = JSON.stringify(t.appliesTo?.sort() ?? [])
          return tScope === tagScope
        })
        .map((t) => t.id)
      selectedTagIds.value = [
        ...selectedTagIds.value.filter((i) => !sameSlotSiblings.includes(i)),
        id,
      ]
    } else {
      selectedTagIds.value = [...selectedTagIds.value, id]
    }
  }

  function isSelected(id: string) {
    return selectedTagIds.value.includes(id)
  }

  function clearTags() {
    selectedTagIds.value = []
  }

  function addTags(ids: string[]) {
    const next = new Set(selectedTagIds.value)
    for (const id of ids) {
      next.add(id)
    }
    selectedTagIds.value = [...next]
  }

  async function recordUsage(ids: string[]) {
    if (!ids.length) return
    try {
      await $fetch('/api/quick-modifiers/usage', {
        method: 'POST',
        body: { modifierIds: ids },
      })
    } catch (e) {
      console.error('Failed to record tag usage', e)
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  function parseAppliesTo(raw: unknown): PresetType[] | null {
    if (!raw) return null
    if (Array.isArray(raw)) return raw as PresetType[]
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return null
  }

  return {
    // Catalog (shared)
    categories: tagCatalog,
    catalogLoaded,
    ensureLoaded,
    fetchTags,

    // Selection (local)
    selectedTagIds,
    selectedTagsList,
    toggleTag,
    isSelected,
    clearTags,
    addTags,

    // Utilities
    allTagsList,
    compiledSnippets,
    searchQuery,
    filteredTags,
    recordUsage,
  }
}
