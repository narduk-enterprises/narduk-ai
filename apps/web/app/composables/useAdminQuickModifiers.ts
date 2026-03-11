import type { QuickModifier } from './useQuickModifiers'

export function useAdminQuickModifiers() {
  const {
    data: modifiers,
    refresh,
    status,
  } = useFetch<QuickModifier[]>('/api/admin/quick-modifiers')

  const toast = useToast()
  const saving = ref(false)

  async function createModifier(data: {
    id: string
    category: string
    label: string
    snippet: string
    sortOrder?: number
    enabled?: number
  }) {
    saving.value = true
    try {
      await $fetch('/api/admin/quick-modifiers', {
        method: 'POST',
        body: data,
      })
      toast.add({ title: 'Created', description: 'Quick modifier added', color: 'success' })
      await refresh()
    } catch (err: unknown) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Error',
        description: error.data?.message || error.message || 'Failed to create modifier',
        color: 'error',
      })
      throw err
    } finally {
      saving.value = false
    }
  }

  async function updateModifier(
    id: string,
    data: {
      category?: string
      label?: string
      snippet?: string
      sortOrder?: number
      enabled?: number
    },
  ) {
    saving.value = true
    try {
      await $fetch(`/api/admin/quick-modifiers/${id}`, {
        method: 'PUT',
        body: data,
      })
      toast.add({ title: 'Updated', description: 'Quick modifier updated', color: 'success' })
      await refresh()
    } catch (err: unknown) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Error',
        description: error.data?.message || error.message || 'Failed to update modifier',
        color: 'error',
      })
      throw err
    } finally {
      saving.value = false
    }
  }

  async function deleteModifier(id: string) {
    saving.value = true
    try {
      await $fetch(`/api/admin/quick-modifiers/${id}`, {
        method: 'DELETE',
      })
      toast.add({ title: 'Deleted', description: 'Quick modifier removed', color: 'success' })
      await refresh()
    } catch (err: unknown) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Error',
        description: error.data?.message || error.message || 'Failed to delete modifier',
        color: 'error',
      })
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    modifiers,
    refresh,
    status,
    saving,
    createModifier,
    updateModifier,
    deleteModifier,
  }
}
