export interface PromptElement {
  id: string
  userId: string
  type: 'person' | 'scene' | 'framing' | 'action' | 'style' | 'prompt'
  name: string
  content: string
  metadata?: string | null
  chatHistory?: string | null
  createdAt: string
  updatedAt: string
}

export interface PresetMetadata {
  headshotUrl?: string | null
  fullBodyUrl?: string | null
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

  async function createElement(
    type: string,
    name: string,
    content: string,
    metadata?: string | null,
  ) {
    loading.value = true
    error.value = null
    try {
      const el = await $fetch<PromptElement>('/api/elements', {
        method: 'POST',
        body: { type, name, content, metadata },
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
    updates: {
      type?: string
      name?: string
      content?: string
      metadata?: string | null
      chatHistory?: string | null
    },
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

  async function composeElements(
    components: Record<string, string | null>,
    mediaType: 'image' | 'video' = 'image',
  ) {
    const parts = ['person', 'scene', 'framing', 'action', 'style']
      .map((t) => {
        const content = components[t]
        if (!content) return null
        return `${t}: ${content}`
      })
      .filter(Boolean)

    if (!parts.length) throw new Error('No components selected')

    const isVideo = mediaType === 'video'
    const systemContent = isVideo
      ? 'You are a prompt engineering expert. The user will provide prompt components (person, scene, framing, action). Compose them into a single, detailed, cohesive video generation prompt for Grok Imagine. Emphasize motion, temporal progression, camera movement, pacing, and dynamic action rather than static composition. Return JSON: { "message": "brief note", "prompt": "the assembled prompt" }. The prompt should be vivid, specific, and ready to use for video generation. Do not include category labels in the prompt — weave them together naturally.'
      : 'You are a prompt engineering expert. The user will provide prompt components (person, scene, framing, action). Compose them into a single, detailed, cohesive image generation prompt. Return JSON: { "message": "brief note", "prompt": "the assembled prompt" }. The prompt should be vivid, specific, and ready to use for image generation. Do not include category labels in the prompt — weave them together naturally.'

    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: {
        chatMode: 'general',
        messages: [
          {
            role: 'system',
            content: systemContent,
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

  async function remixPrompt(
    currentPrompt: string,
    mediaType: 'image' | 'video' = 'image',
    presets?: Record<string, string>,
  ) {
    if (!currentPrompt.trim()) throw new Error('No prompt to remix')

    // Resolve preset content if presets are provided
    let resolved: Record<string, { name: string; content: string }> = {}
    if (presets && Object.keys(presets).length) {
      try {
        const res = await $fetch<{
          resolved: Record<string, { name: string; content: string }>
        }>('/api/elements/resolve-presets', {
          method: 'POST',
          body: { presets },
        })
        resolved = res.resolved
      } catch {
        /* continue without resolved presets */
      }
    }

    const hasPresets = Object.keys(resolved).length > 0
    const personPreset = resolved.person
    const themePresets = Object.entries(resolved).filter(([type]) => type !== 'person')
    const isVideo = mediaType === 'video'

    let systemContent: string

    if (hasPresets) {
      const parts: string[] = [
        'You are a creative prompt remixer for AI ' +
          mediaType +
          ' generation. Create a DRAMATICALLY DIFFERENT variation of the user\'s prompt.',
      ]

      if (personPreset) {
        parts.push(
          '\n\nPERSON — DO NOT CHANGE (reproduce with pixel-perfect accuracy):\n' +
            personPreset.content +
            '\n\nThe person MUST appear exactly as described — same face, skin tone, hair, body type, and all features.',
        )
      }

      if (themePresets.length > 0) {
        parts.push(
          '\n\nTHEME CONTEXT (loose inspiration only — make something COMPLETELY DIFFERENT):',
        )
        for (const [type, preset] of themePresets) {
          parts.push(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${preset.content}`)
        }
      }

      parts.push(
        '\n\nREMIX RULES:' +
          '\n- ' +
          (personPreset
            ? 'Keep the person IDENTICAL — do not change any physical traits'
            : 'Keep the core subject recognizable') +
          '\n- Radically change scene, setting, time of day, weather, lighting, color palette' +
          '\n- Try a completely different camera angle, composition, and visual style' +
          (isVideo ? '\n- Include different motion dynamics, camera movement, and pacing' : '') +
          '\n\nReturn JSON: { "message": "one-line summary of what you changed", "prompt": "the remixed prompt" }. Make DRAMATIC creative changes, not subtle tweaks.',
      )

      systemContent = parts.join('\n')
    } else {
     systemContent = isVideo
      ? 'You are a creative prompt remixer. The user will give you a video generation prompt for Grok Imagine. Create a fresh variation that keeps the same general theme and mood but changes specific details — swap out visual elements, shift the atmosphere, alter camera movements, change the pacing or motion dynamics, or add unexpected twists. CRITICAL: The output MUST look like real footage shot on a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Include cues like "photorealistic", "shot on [real camera]", "natural lighting", "film grain", "shallow depth of field", or "35mm film" to anchor realism. Return JSON: { "message": "one-line summary of what you changed", "prompt": "the remixed prompt" }. Make meaningful creative changes, not just synonym swaps. Keep the result optimized for video generation.'
      : 'You are a creative prompt remixer. The user will give you an image/video generation prompt. Create a fresh variation that keeps the same general theme and mood but changes specific details — swap out some visual elements, shift the atmosphere, alter the composition, or add unexpected twists. CRITICAL: The output MUST look like a real photograph taken with a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Include cues like "photorealistic", "shot on [real camera]", "natural lighting", "film grain", "shallow depth of field", or "35mm film" to anchor realism. Return JSON: { "message": "one-line summary of what you changed", "prompt": "the remixed prompt" }. Make meaningful creative changes, not just synonym swaps.'
    }

    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: {
        chatMode: 'general',
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: `Remix this prompt:\n\n${currentPrompt}`,
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
      style: [],
      prompt: [],
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
    remixPrompt,
  }
}
