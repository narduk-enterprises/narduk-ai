export interface UserPrompt {
  id: string
  userId: string
  title: string
  prompt: string
  initialPresets?: string | null
  chatHistory?: string | null
  createdAt: string
  updatedAt: string
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
  ) {
    loading.value = true
    error.value = null
    try {
      const el = await $fetch<UserPrompt>('/api/prompts', {
        method: 'POST',
        body: { title, prompt, initialPresets, chatHistory },
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

  return {
    prompts,
    loading,
    error,
    fetchPrompts,
    savePrompt,
    deletePrompt,
  }
}
