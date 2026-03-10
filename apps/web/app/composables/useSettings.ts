/**
 * useSettings — localStorage-backed default generation preferences.
 *
 * Persists user defaults for aspect ratio, duration, and resolution
 * across sessions. Used by the generate page as initial form values
 * and configurable from the /settings page.
 */

const STORAGE_KEY = 'narduk-ai-settings'

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'
export type Resolution = '480p' | '720p'

interface Settings {
  defaultAspectRatio: AspectRatio
  defaultDuration: number
  defaultResolution: Resolution
}

const DEFAULTS: Settings = {
  defaultAspectRatio: '9:16',
  defaultDuration: 6,
  defaultResolution: '720p',
}

function loadSettings(): Settings {
  if (import.meta.server) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveSettings(settings: Settings) {
  if (import.meta.server) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const settings = useState<Settings>('app-settings', () => loadSettings())

  // Hydrate from localStorage on client mount
  if (import.meta.client) {
    onMounted(() => {
      settings.value = loadSettings()
    })
  }

  const defaultAspectRatio = computed({
    get: () => settings.value.defaultAspectRatio,
    set: (v: AspectRatio) => {
      settings.value = { ...settings.value, defaultAspectRatio: v }
      saveSettings(settings.value)
    },
  })

  const defaultDuration = computed({
    get: () => settings.value.defaultDuration,
    set: (v: number) => {
      settings.value = { ...settings.value, defaultDuration: Math.min(15, Math.max(1, v)) }
      saveSettings(settings.value)
    },
  })

  const defaultResolution = computed({
    get: () => settings.value.defaultResolution,
    set: (v: Resolution) => {
      settings.value = { ...settings.value, defaultResolution: v }
      saveSettings(settings.value)
    },
  })

  function resetDefaults() {
    settings.value = { ...DEFAULTS }
    saveSettings(settings.value)
  }

  return {
    defaultAspectRatio,
    defaultDuration,
    defaultResolution,
    resetDefaults,
  }
}
