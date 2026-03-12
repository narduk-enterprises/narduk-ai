import type { Generation } from '~/types/generation'

/**
 * useFeelingLucky — handles the "Feeling Lucky" feature that randomly picks
 * presets and auto-generates a prompt via cached prompts or real-time Grok.
 *
 * v2: Uses singleton usePromptElements, activePresetIds (ID-based).
 */
export function useFeelingLucky(deps: {
  activeTab: Ref<string>
  prompt: Ref<string>
  activePresets: Ref<Record<string, string>>
  activePresetIds: Ref<string[]>
  generating: Ref<boolean>
  error: Ref<string | null>
  latestResult: Ref<Generation | null>
  latestResults: Ref<Generation[]>
  handleGenerate: () => Promise<void>
}) {
  const {
    activeTab,
    prompt,
    activePresets,
    activePresetIds,
    generating,
    error,
    latestResult,
    latestResults,
    handleGenerate,
  } = deps

  const feelingLucky = ref(false)

  // Use singleton prompt elements — no duplicate instance
  const { elements, fetchElements } = usePromptElements()

  async function handleFeelingLucky() {
    if (feelingLucky.value || generating.value) return
    feelingLucky.value = true
    error.value = null
    latestResult.value = null
    latestResults.value = []

    try {
      const isVideo = activeTab.value === 't2v' || activeTab.value === 'i2v'
      const mediaType = isVideo ? 'video' : 'image'

      // ── Try cached prompt first (instant) ──
      const cached = await $fetch<{
        cached: boolean
        prompt?: string
        presets?: Record<string, string>
      }>('/api/generate/lucky-consume', {
        method: 'POST',
        body: { mediaType },
      })

      if (cached.cached && cached.prompt && cached.presets) {
        prompt.value = cached.prompt
        activePresets.value = cached.presets

        // Resolve preset names → IDs from loaded elements (match by type + name)
        const ids: string[] = []
        for (const [type, name] of Object.entries(cached.presets)) {
          const el = elements.value.find((e) => e.type === type && e.name === name)
          if (el) ids.push(el.id)
        }
        activePresetIds.value = ids

        await handleGenerate()

        // Fire background prefill to replenish cache (fire-and-forget)
        $fetch('/api/generate/lucky-prefill', {
          method: 'POST',
          body: { count: 2, mediaType },
        }).catch(() => {})

        return
      }

      // ── Fallback: pick random presets locally (no LLM) ──
      if (!elements.value.length) {
        await fetchElements()
      }

      const allElements = elements.value
      if (!allElements.length) {
        error.value = 'No presets available. Create some presets first!'
        return
      }

      // Group by type
      const byType: Record<string, typeof allElements> = {}
      for (const el of allElements) {
        if (!byType[el.type]) byType[el.type] = []
        byType[el.type]!.push(el)
      }

      // Pick random elements: always pick a person if available, then 1-2 others
      const picked: Record<string, string> = {}
      const pickedIds: string[] = []

      if (byType.person?.length) {
        const person = byType.person[Math.floor(Math.random() * byType.person.length)]!
        picked.person = person.name
        pickedIds.push(person.id)
      }

      const otherTypes = ['scene', 'framing', 'action', 'style'].filter((t) => byType[t]?.length)
      const shuffled = otherTypes.sort(() => Math.random() - 0.5)
      const pickCount = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
      for (let i = 0; i < pickCount; i++) {
        const type = shuffled[i]!
        const el = byType[type]![Math.floor(Math.random() * byType[type]!.length)]!
        picked[type] = el.name
        pickedIds.push(el.id)
      }

      if (!pickedIds.length) {
        error.value = 'No suitable presets found.'
        return
      }

      // Set presets and let the prompt compiler do the work — no LLM call
      prompt.value = ''
      activePresets.value = picked
      activePresetIds.value = pickedIds

      await handleGenerate()
    } catch (e) {
      console.error('Feeling Lucky failed:', e)
      error.value = 'Feeling Lucky failed. Try again!'
    } finally {
      feelingLucky.value = false
    }
  }

  return {
    feelingLucky,
    handleFeelingLucky,
  }
}
