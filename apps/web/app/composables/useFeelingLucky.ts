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

      // ── Fallback: real-time Grok generation ──
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
      const pickedContent: string[] = []

      if (byType.person?.length) {
        const person = byType.person[Math.floor(Math.random() * byType.person.length)]!
        picked.person = person.name
        pickedIds.push(person.id)
        pickedContent.push(`person: ${person.content}`)
      }

      const otherTypes = ['scene', 'framing', 'action', 'style'].filter((t) => byType[t]?.length)
      const shuffled = otherTypes.sort(() => Math.random() - 0.5)
      const pickCount = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
      for (let i = 0; i < pickCount; i++) {
        const type = shuffled[i]!
        const el = byType[type]![Math.floor(Math.random() * byType[type]!.length)]!
        picked[type] = el.name
        pickedIds.push(el.id)
        pickedContent.push(`${type}: ${el.content}`)
      }

      if (!pickedContent.length) {
        error.value = 'No suitable presets found.'
        return
      }

      // Generate prompt via Grok with strong photorealism guardrails
      const mediaLabel = isVideo ? 'video' : 'image'

      const res = await $fetch<{ content: string }>('/api/generate/chat', {
        method: 'POST',
        body: {
          chatMode: 'general',
          messages: [
            {
              role: 'system',
              content:
                `You are a wildly creative ${mediaLabel} prompt generator for Grok Imagine. ` +
                `The user has given you some preset components. Your job is to invent an AMAZING, ` +
                `unexpected, and visually stunning scenario using these components. Be bold and imaginative — ` +
                `surreal situations are great (e.g. riding a rhino at a football game, having tea on the moon, ` +
                `swimming with whales in a city). The crazier the better!\n\n` +
                `CRITICAL PHOTOREALISM RULES:\n` +
                `- The ${mediaLabel} MUST look like it was captured by a REAL camera — photorealistic, cinematic, lifelike\n` +
                `- Include anchors like "photorealistic", "shot on Sony A7IV", "natural lighting", "shallow depth of field", "film grain", "35mm"\n` +
                `- NEVER produce anything that looks like CGI, cartoon, anime, illustration, 3D render, digital art, painting, or fantasy art\n` +
                `- Real skin textures, real environments, real physics of light — even if the scenario itself is impossible\n` +
                `- Think of it as "what if a photographer actually captured this impossible moment?"\n` +
                (isVideo
                  ? `- For video: emphasize natural motion, camera movement, temporal progression, and cinematic pacing\n`
                  : '') +
                `\nReturn JSON ONLY: { "prompt": "the complete generation prompt" }`,
            },
            {
              role: 'user',
              content: `Here are my presets — invent something wild:\n\n${pickedContent.join('\n')}`,
            },
          ],
        },
      })

      const parsed = JSON.parse(res.content)
      const luckyPrompt = (parsed.prompt || '') as string

      if (!luckyPrompt) {
        error.value = 'Failed to generate a lucky prompt. Try again!'
        return
      }

      // Set the prompt, presets (names + IDs), then auto-generate
      prompt.value = luckyPrompt
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
