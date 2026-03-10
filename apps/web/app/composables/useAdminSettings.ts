// Types defined below

export type SettingsFields = {
  videoModel: string
  imageModel: string
  promptEnhanceModel: string
}

export function useAdminSettings() {
  const {
    data: currentSettings,
    status,
    refresh,
    error,
  } = useAsyncData<SettingsFields>('admin-settings', () =>
    $fetch<SettingsFields>('/api/admin/settings'),
  )

  async function updateSettings(settings: SettingsFields) {
    return $fetch<SettingsFields>('/api/admin/settings', {
      method: 'PUT',
      body: settings,
    })
  }

  return {
    currentSettings,
    status,
    refresh,
    error,
    updateSettings,
  }
}
