export interface PromptElement {
  id: string
  userId: string
  type: 'person' | 'scene' | 'framing' | 'action' | 'prompt'
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

  async function updateElement(
    id: string,
    updates: { type?: string; name?: string; content?: string },
  ) {
    loading.value = true
    error.value = null
    try {
      const updated = await $fetch<PromptElement>(`/api/elements/${id}`, {
        method: 'PATCH',
        body: updates,
      })
      const idx = elements.value.findIndex((e) => e.id === id)
      if (idx !== -1) elements.value[idx] = updated
      return updated
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to update element'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function composeElements(components: Record<string, string | null>) {
    const parts = ['person', 'scene', 'framing', 'action']
      .map((t) => {
        const content = components[t]
        if (!content) return null
        return `${t}: ${content}`
      })
      .filter(Boolean)

    if (!parts.length) throw new Error('No components selected')

    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: {
        chatMode: 'general',
        messages: [
          {
            role: 'system',
            content:
              'You are a prompt engineering expert. The user will provide prompt components (person, scene, framing, action). Compose them into a single, detailed, cohesive image generation prompt. Return JSON: { "message": "brief note", "prompt": "the assembled prompt" }. The prompt should be vivid, specific, and ready to use for image generation. Do not include category labels in the prompt — weave them together naturally.',
          },
          {
            role: 'user',
            content: `Compose these components into a generation prompt:\n\n${parts.join('\n')}`,
          },
        ],
      },
    })
    const parsed = JSON.parse(res.content)
    return (parsed.prompt || parsed.message || res.content) as string
  }

  const groupedByType = computed(() => {
    const groups: Record<string, PromptElement[]> = {
      person: [],
      scene: [],
      framing: [],
      action: [],
    }
    for (const el of elements.value) {
      if (groups[el.type]) {
        groups[el.type]!.push(el)
      }
    }
    return groups
  })

  return {
    elements,
    groupedByType,
    loading,
    error,
    fetchElements,
    createElement,
    updateElement,
    deleteElement,
    composeElements,
  }
}
