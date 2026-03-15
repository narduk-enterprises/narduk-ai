/**
 * usePromptTemplates — manages prompt templates (structural patterns for prompt composition).
 *
 * Templates define the sentence structure of compiled prompts.
 * System templates are always available; users can also create custom ones.
 */

export interface PromptTemplate {
  id: string
  userId: string | null
  name: string
  description: string | null
  category: string
  pattern: string
  slots: string[]
  isSystem: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function usePromptTemplates() {
  const templates = ref<PromptTemplate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTemplates() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<PromptTemplate[]>('/api/templates')
      templates.value = data
    } catch (e) {
      error.value = (e as { message?: string }).message || 'Failed to load templates'
    } finally {
      loading.value = false
    }
  }

  async function createTemplate(payload: {
    name: string
    description?: string
    category?: string
    pattern: string
    slots: string[]
  }) {
    loading.value = true
    error.value = null
    try {
      const tpl = await $fetch<PromptTemplate>('/api/templates', {
        method: 'POST',
        body: payload,
      })
      templates.value.unshift(tpl)
      return tpl
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to create template'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteTemplate(id: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/templates/${id}`, { method: 'DELETE' })
      templates.value = templates.value.filter((t) => t.id !== id)
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to delete template'
      throw e
    } finally {
      loading.value = false
    }
  }

  // ─── Template Compilation ──────────────────────────────────

  /**
   * Compile a template pattern by replacing [SLOT] placeholders with prose content.
   * slotContent maps slot type (e.g. "person") to its prose representation.
   */
  function compileTemplate(template: PromptTemplate, slotContent: Record<string, string>): string {
    let result = template.pattern

    for (const slot of template.slots) {
      const placeholder = `[${slot.toUpperCase()}]`
      const content = slotContent[slot] || ''
      result = result.replaceAll(placeholder, content)
    }

    // Clean up: remove empty slots, double spaces, trailing periods
    return result
      .replaceAll(/\[\w+\]/g, '') // Remove unfilled slots
      .replaceAll(/\s{2,}/g, ' ') // Collapse whitespace
      .replaceAll(/\.\s*\./g, '.') // Collapse double periods
      .replaceAll(/,\s*\./g, '.') // Remove trailing comma before period
      .trim()
  }

  // ─── Computed ──────────────────────────────────────────────

  const systemTemplates = computed(() => templates.value.filter((t) => t.isSystem))

  const userTemplates = computed(() => templates.value.filter((t) => !t.isSystem))

  return {
    templates,
    systemTemplates,
    userTemplates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    compileTemplate,
  }
}
