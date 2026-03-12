import { normalizeChatRequestMessages } from '~/utils/chatHistory'

export interface PromptElement {
  id: string
  userId: string
  type: 'person' | 'scene' | 'framing' | 'action' | 'style' | 'prompt'
  name: string
  content: string
  attributes?: string | null
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
  // Singleton state via useState — all consumers share the same fetched data
  const elements = useState<PromptElement[]>('prompt-elements', () => [])
  const loading = useState<boolean>('prompt-elements-loading', () => false)
  const error = useState<string | null>('prompt-elements-error', () => null)

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
    attributes?: string | null,
  ) {
    loading.value = true
    error.value = null
    try {
      const el = await $fetch<PromptElement>('/api/elements', {
        method: 'POST',
        body: { type, name, content, metadata, attributes },
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
      attributes?: string | null
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

        const element = elements.value.find((el) => el.type === t && el.content === content)
        if (!element?.attributes) return null
        try {
          const attrs = JSON.parse(element.attributes) as Record<string, string>
          const structured = Object.entries(attrs)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1).replaceAll('_', ' ')}: ${v}`)
            .join('\n')
          return `[${t}]\n${structured}`
        } catch {
          return null
        }
      })
      .filter(Boolean)

    if (!parts.length) throw new Error('No components selected')

    const isVideo = mediaType === 'video'
    const systemContent = isVideo
      ? 'You are a prompt engineering expert. The user will provide prompt components (person, scene, framing, action). Compose them into a single, detailed, cohesive video generation prompt for Grok Imagine. Emphasize motion, temporal progression, camera movement, pacing, and dynamic action rather than static composition. CRITICAL: The prompt MUST produce results that look like real footage shot on a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER create prompts that would produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Always include photorealism anchors such as "photorealistic", "shot on [real camera]", "natural lighting", "film grain", or "35mm film". Return JSON: { "message": "brief note", "prompt": "the assembled prompt" }. The prompt should be vivid, specific, and ready to use for video generation. Do not include category labels in the prompt — weave them together naturally.'
      : 'You are a prompt engineering expert. The user will provide prompt components (person, scene, framing, action). Compose them into a single, detailed, cohesive image generation prompt. CRITICAL: The prompt MUST produce results that look like a real photograph taken with a real camera — photorealistic, natural lighting, real skin textures, real environments. NEVER create prompts that would produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. Always include photorealism anchors such as "photorealistic", "shot on [real camera]", "natural lighting", "film grain", or "35mm film". Return JSON: { "message": "brief note", "prompt": "the assembled prompt" }. The prompt should be vivid, specific, and ready to use for image generation. Do not include category labels in the prompt — weave them together naturally.'

    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: {
        chatMode: 'general',
        messages: normalizeChatRequestMessages([
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: `Compose these components into a generation prompt:\n\n${parts.join('\n')}`,
          },
        ]),
      },
    })
    const parsed = JSON.parse(res.content)
    return (parsed.prompt || parsed.message || res.content) as string
  }

  // ── Client-side remix helpers ─────────────────────────────────────

  /**
   * Attribute keys we're willing to randomize client-side.
   * Person-identity keys are intentionally excluded to preserve the subject.
   */
  const REMIX_ATTRIBUTE_KEYS = new Set([
    'lighting',
    'time_of_day',
    'weather',
    'mood',
    'location',
    'background',
    'color_palette',
    'season',
    'environment',
    'atmosphere',
    'camera_angle',
    'depth_of_field',
  ])

  /**
   * Replace attribute lines in a compiled prompt with a randomly chosen
   * snippet from the loaded tag catalog for the same attributeKey.
   * Falls back silently if no alternative tags are available.
   */
  function remixClientSide(compiledPrompt: string): string {
    // Access the shared tag catalog via its useState key
    const tagCatalog = useState<{ attributeKey: string; tags: { snippet: string }[] }[]>(
      'prompt-tag-catalog',
      () => [],
    )
    if (!tagCatalog.value.length) return compiledPrompt

    // Build a lookup: attributeKey → list of available snippets
    const snippetMap: Record<string, string[]> = {}
    for (const cat of tagCatalog.value) {
      if (REMIX_ATTRIBUTE_KEYS.has(cat.attributeKey)) {
        snippetMap[cat.attributeKey] = cat.tags.map((t) => t.snippet).filter(Boolean)
      }
    }

    // Replace matching `Key: Value` lines in the compiled prompt
    return compiledPrompt.replaceAll(/^(\w[\w ]*): (\S.*)$/gm, (match, key) => {
      const attrKey = key.trim().toLowerCase().replaceAll(' ', '_')
      const options = snippetMap[attrKey]
      if (!options?.length) return match
      // Pick a random different snippet
      const randomIdx = Math.floor(Math.random() * options.length)
      return `${key.trim()}: ${options[randomIdx]}`
    })
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

    // ── Fast path: client-side remix for structured prompts ──────────
    // When presets are attached, we have structured key: value lines that
    // can be randomized locally from the tag catalog — no LLM call needed.
    if (hasPresets) {
      const remixed = remixClientSide(currentPrompt)
      // If nothing was changed (no matching tags in catalog), fall through to Grok
      if (remixed !== currentPrompt) return remixed
    }

    // ── Slow path: Grok LLM call for free-form text ──────────────────
    const personPreset = resolved.person
    const themePresets = Object.entries(resolved).filter(([type]) => type !== 'person')
    const isVideo = mediaType === 'video'

    let systemContent: string

    if (hasPresets) {
      const parts: string[] = [
        'You are a realistic photo prompt remixer for AI ' +
          mediaType +
          " generation. Create a NATURAL VARIATION of the user's prompt — same general mood and subject, but with meaningful differences in setting, time of day, lighting, or composition. Results must look like real-world everyday photography.",
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
            ? 'Keep the person IDENTICAL — do not change any physical traits or appearance'
            : 'Keep the core subject recognizable') +
          '\n- Vary the scene naturally: change time of day, light direction, or weather' +
          '\n- Try a slightly different camera angle or framing (not extreme)' +
          (isVideo
            ? '\n- Vary camera movement subtly — handheld feel, gentle pan, or static'
            : '') +
          '\n- Result MUST look like a real photograph — photorealistic, natural lighting, real environments' +
          '\n- NEVER produce cartoon, illustration, CGI, 3D render, or anime results' +
          '\n\nReturn JSON: { "message": "one-line summary of what you changed", "prompt": "the remixed prompt" }. Make natural creative variations, not extreme transformations.',
      )

      systemContent = parts.join('\n')
    } else {
      systemContent = isVideo
        ? 'You are a realistic photo/video prompt remixer. The user will give you a video generation prompt for Grok Imagine. Create a natural variation that keeps the same subject and mood but shifts specific details — change the location slightly, vary the time of day, adjust the weather or light direction, or try a different camera angle. CRITICAL: The output MUST look like real footage shot on a real camera — photorealistic, natural lighting, real environments. NEVER produce cartoon, illustration, CGI, 3D render, or anime results. Return JSON: { "message": "one-line summary", "prompt": "the remixed prompt" }.'
        : 'You are a realistic photo prompt remixer. The user will give you an image generation prompt. Create a natural variation that keeps the same subject and mood but shifts specific details — change the location slightly, vary the time of day, adjust the weather or light direction, try a different camera angle. CRITICAL: The output MUST look like a real photograph — photorealistic, natural lighting, real environments. NEVER produce cartoon, illustration, CGI, 3D render, or anime results. Return JSON: { "message": "one-line summary", "prompt": "the remixed prompt" }.'
    }

    const res = await $fetch<{ content: string }>('/api/generate/chat', {
      method: 'POST',
      body: {
        chatMode: 'general',
        messages: normalizeChatRequestMessages([
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: `Remix this prompt:\n\n${currentPrompt}`,
          },
        ]),
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
