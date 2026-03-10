/**
 * Admin composable for generation diagnostics.
 * Provides methods for listing, refreshing, and failing generations.
 */
export function useAdminGenerations() {
  interface AdminGeneration {
    id: string
    userId: string
    type: 'image' | 'video'
    mode: string
    prompt: string
    status: string
    xaiRequestId: string | null
    r2Key: string | null
    mediaUrl: string | null
    duration: number | null
    aspectRatio: string | null
    resolution: string | null
    metadata: string | null
    createdAt: string
    updatedAt: string
    ageMinutes: number
    isStale: boolean
    errorInfo: string | null
  }

  interface RefreshResult extends AdminGeneration {
    refreshResult: string
    message?: string
  }

  async function fetchAll(): Promise<AdminGeneration[]> {
    return await $fetch<AdminGeneration[]>('/api/admin/generations')
  }

  async function refreshGeneration(id: string): Promise<RefreshResult> {
    return await $fetch<RefreshResult>(`/api/admin/generations/${id}/refresh`, {
      method: 'POST',
    })
  }

  async function failGeneration(id: string, reason: string): Promise<AdminGeneration> {
    return await $fetch<AdminGeneration>(`/api/admin/generations/${id}/fail`, {
      method: 'POST',
      body: { reason },
    })
  }

  return { fetchAll, refreshGeneration, failGeneration }
}
