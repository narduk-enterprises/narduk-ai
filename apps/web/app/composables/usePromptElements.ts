export interface PromptElement {
  id: string
  userId: string
  type: 'person' | 'scene' | 'framing' | 'action'
  name: string
  content: string
  createdAt: string
  updatedAt: string
}

export function usePromptElements() {
  const elements = ref<PromptElement[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchElements() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<PromptElement[]>('/api/elements')
      elements.value = data
    } catch (e) {
      error.value = (e as { message?: string }).message || 'Failed to load elements'
    } finally {
      loading.value = false
    }
  }

  async function createElement(type: string, name: string, content: string) {
    loading.value = true
    error.value = null
    try {
      const el = await $fetch<PromptElement>('/api/elements', {
        method: 'POST',
        body: { type, name, content },
      })
      // Prepend to array since the API orders newest first
      elements.value.unshift(el)
      return el
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to create element'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteElement(id: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/elements/${id}`, { method: 'DELETE' })
      elements.value = elements.value.filter((e) => e.id !== id)
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to delete element'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    elements,
    loading,
    error,
    fetchElements,
    createElement,
    deleteElement,
  }
}
