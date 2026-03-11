export interface SystemPromptEntry {
  name: string
  content: string
  description: string
  updatedAt: string
}

export function useAdminSystemPrompts() {
  const {
    data: prompts,
    refresh,
    status,
  } = useFetch<SystemPromptEntry[]>('/api/admin/system-prompts')

  const toast = useToast()
  const saving = ref(false)

  async function updatePrompt(name: string, content: string) {
    saving.value = true
    try {
      await $fetch(`/api/admin/system-prompts/${name}`, {
        method: 'PUT',
        body: { content },
      })
      toast.add({ title: 'Success', description: 'System prompt updated', color: 'success' })
      await refresh()
    } catch (err: unknown) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Error',
        description: error.data?.message || error.message || 'Failed to update prompt',
        color: 'error',
      })
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    prompts,
    refresh,
    status,
    saving,
    updatePrompt,
  }
}
