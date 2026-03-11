import type { Generation } from '~/types/generation'

/**
 * Composable for AI media generation.
 * Provides methods for generating images/videos and managing polling state.
 */
export function useGenerate() {
  const generating = ref(false)
  const remixing = ref(false)
  const error = ref<string | null>(null)
  const pollingIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map())

  /**
   * Generate an image from text (T2I).
   */
  async function generateImage(
    prompt: string,
    options?: {
      aspectRatio?: string
      promptElements?: string[]
      presets?: Record<string, string>
      userPromptId?: string
    },
  ): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/image', {
        method: 'POST',
        body: {
          prompt,
          aspectRatio: options?.aspectRatio,
          promptElements: options?.promptElements,
          presets: options?.presets,
          userPromptId: options?.userPromptId,
        },
      })
      return result
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to generate image'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Edit an image with a prompt (I2I).
   */
  async function editImage(
    prompt: string,
    sourceGenerationId: string,
    options?: {
      promptElements?: string[]
      presets?: Record<string, string>
      userPromptId?: string
    },
  ): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/image-edit', {
        method: 'POST',
        body: {
          prompt,
          sourceGenerationId,
          promptElements: options?.promptElements,
          presets: options?.presets,
          userPromptId: options?.userPromptId,
        },
      })
      return result
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to edit image'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Generate a video from text (T2V).
   */
  async function generateVideo(
    prompt: string,
    options?: {
      duration?: number
      aspectRatio?: string
      resolution?: string
      promptElements?: string[]
      presets?: Record<string, string>
      userPromptId?: string
    },
  ): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/video', {
        method: 'POST',
        body: {
          prompt,
          duration: options?.duration || 6,
          aspectRatio: options?.aspectRatio || '16:9',
          resolution: options?.resolution || '720p',
          promptElements: options?.promptElements,
          presets: options?.presets,
          userPromptId: options?.userPromptId,
        },
      })
      return result
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to start video generation'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Generate a video from an image (I2V).
   */
  async function generateVideoFromImage(
    prompt: string,
    sourceGenerationId: string,
    options?: {
      duration?: number
      resolution?: string
      promptElements?: string[]
      presets?: Record<string, string>
      userPromptId?: string
    },
  ): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/video-from-image', {
        method: 'POST',
        body: {
          prompt,
          sourceGenerationId,
          duration: options?.duration || 6,
          resolution: options?.resolution || '720p',
          promptElements: options?.promptElements,
          presets: options?.presets,
          userPromptId: options?.userPromptId,
        },
      })
      return result
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to start video from image'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Poll a pending video generation until done using exponential backoff.
   * Returns a reactive generation ref that updates as polling progresses.
   */
  function pollGeneration(generation: Ref<Generation>, onComplete?: (gen: Generation) => void) {
    if (!generation.value.xaiRequestId) return

    const requestId = generation.value.xaiRequestId
    let delay = 5000
    const maxDelay = 30000
    let consecutiveErrors = 0

    const executePoll = async () => {
      try {
        const result = await $fetch<Generation>(`/api/generate/poll/${requestId}`)
        consecutiveErrors = 0
        generation.value = result

        if (result.status === 'done' || result.status === 'failed' || result.status === 'expired') {
          pollingIntervals.value.delete(requestId)
          onComplete?.(result)
          return
        }

        // Exponential backoff
        delay = Math.min(delay * 1.5, maxDelay)
        const nextTimeout = setTimeout(executePoll, delay)
        pollingIntervals.value.set(requestId, nextTimeout)
      } catch {
        consecutiveErrors++
        // Allow up to 3 consecutive network errors before giving up
        if (consecutiveErrors >= 3) {
          pollingIntervals.value.delete(requestId)
          error.value =
            'Lost connection while checking video status. The video may still be generating — check your gallery in a few minutes.'
          generation.value = { ...generation.value, status: 'failed' as const }
          onComplete?.(generation.value)
        } else {
          // Retry with backoff on transient errors
          delay = Math.min(delay * 2, maxDelay)
          const nextTimeout = setTimeout(executePoll, delay)
          pollingIntervals.value.set(requestId, nextTimeout)
        }
      }
    }

    const initialTimeout = setTimeout(executePoll, delay)
    pollingIntervals.value.set(requestId, initialTimeout)
  }

  /**
   * Stop all active polling.
   */
  function stopAllPolling() {
    for (const timer of pollingIntervals.value.values()) {
      clearTimeout(timer)
    }
    pollingIntervals.value.clear()
  }

  /**
   * Fetch user's generation gallery.
   */
  async function fetchGenerations(
    limit = 50,
    offset = 0,
    search?: string,
    filters?: { type?: string; mode?: string },
  ): Promise<Generation[]> {
    return await $fetch<Generation[]>('/api/generations', {
      query: {
        limit,
        offset,
        search: search || undefined,
        type: filters?.type || undefined,
        mode: filters?.mode || undefined,
      },
    })
  }

  /**
   * Fetch a single generation.
   */
  async function fetchGeneration(id: string): Promise<Generation> {
    return await $fetch<Generation>(`/api/generations/${id}`)
  }

  /**
   * Delete a generation.
   */
  async function deleteGeneration(id: string): Promise<void> {
    await $fetch(`/api/generations/${id}`, { method: 'DELETE' })
  }

  /**
   * Upscale an image to 2K resolution.
   */
  async function upscaleGeneration(generationId: string): Promise<Generation | null> {
    try {
      return await $fetch<Generation>('/api/generate/upscale', {
        method: 'POST',
        body: { generationId },
      })
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to upscale image'
      return null
    }
  }

  /**
   * Remix a generation — resolves any presets to build targeted remix
   * instructions that preserve person traits while radically changing the scene,
   * then auto-submits a new generation with the remixed prompt.
   */
  async function remixGeneration(gen: Generation): Promise<Generation | null> {
    remixing.value = true
    error.value = null
    try {
      // Parse presets from the generation record
      let presets: Record<string, string> | undefined
      if (gen.presets) {
        try {
          presets = JSON.parse(gen.presets) as Record<string, string>
        } catch {
          /* ignore invalid JSON */
        }
      }

      // Resolve preset content if presets exist
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

      // Build preset-aware remix instructions
      const remixInstructions = buildRemixInstructions(resolved, gen.type)

      const { enhancedPrompt } = await $fetch<{ enhancedPrompt: string }>(
        '/api/generate/enhance-prompt',
        {
          method: 'POST',
          body: {
            prompt: gen.prompt,
            instructions: remixInstructions,
            mediaType: gen.type,
          },
        },
      )

      const remixedPrompt = enhancedPrompt || gen.prompt

      // Generate with the remixed prompt, carrying presets through
      if (gen.type === 'video') {
        return await generateVideo(remixedPrompt, {
          duration: gen.duration || 6,
          aspectRatio: gen.aspectRatio || '16:9',
          resolution: gen.resolution || '720p',
          presets,
        })
      } else {
        return await generateImage(remixedPrompt, {
          aspectRatio: gen.aspectRatio || undefined,
          presets,
        })
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to remix generation'
      return null
    } finally {
      remixing.value = false
    }
  }

  /**
   * Build remix instructions based on resolved preset content.
   * Person traits are locked; everything else is fair game for radical change.
   */
  function buildRemixInstructions(
    resolved: Record<string, { name: string; content: string }>,
    mediaType: 'image' | 'video',
  ): string {
    const hasPresets = Object.keys(resolved).length > 0
    const personPreset = resolved.person
    const themePresets = Object.entries(resolved).filter(([type]) => type !== 'person')

    if (!hasPresets) {
      // Fallback: no presets, use aggressive generic remix
      return (
        'Creatively remix this prompt — change several elements such as the setting, ' +
        'time of day, lighting, color palette, camera angle, or mood. ' +
        'Keep the core subject/character but reimagine the scene in a fresh and surprising way. ' +
        'CRITICAL: The result MUST look like a real photograph taken with a real camera — ' +
        'photorealistic, natural lighting, real skin textures, real environments. ' +
        'NEVER produce cartoon, illustration, CGI, 3D render, anime, digital art, painterly, or fantasy-looking results. ' +
        'Include cues like "photorealistic", "shot on [real camera]", "natural lighting", "film grain", or "35mm film" to anchor realism. ' +
        'Return ONLY the remixed prompt.'
      )
    }

    const parts: string[] = []

    parts.push(
      'You are a creative remix engine for AI ' +
        mediaType +
        ' generation. ' +
        'Your job is to create a DRAMATICALLY DIFFERENT variation of the original prompt.',
    )

    if (personPreset) {
      parts.push(
        '\n\nPERSON — DO NOT CHANGE (reproduce these traits with pixel-perfect accuracy):\n' +
          personPreset.content +
          '\n\nThe person described above MUST appear exactly as described — ' +
          'same face shape, skin tone, hair, body type, and all distinguishing features. ' +
          'Do NOT alter the person in any way.',
      )
    }

    if (themePresets.length > 0) {
      parts.push(
        '\n\nTHEME CONTEXT (use as loose inspiration, but create something COMPLETELY DIFFERENT):',
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
        '\n- Radically change the scene, setting, environment, time of day, and weather' +
        '\n- Use a completely different lighting setup, color palette, and atmosphere' +
        '\n- Try a different camera angle, composition, and visual style' +
        '\n- The result should look like an ENTIRELY DIFFERENT ' +
        mediaType +
        ' of the same ' +
        (personPreset ? 'person' : 'subject') +
        (mediaType === 'video'
          ? '\n- Include different motion dynamics, camera movement, and pacing'
          : '') +
        '\n\nReturn ONLY the remixed prompt text.',
    )

    return parts.join('\n')
  }

  /**
   * Retry a failed/expired generation by re-dispatching based on mode.
   */
  async function retryGeneration(gen: Generation): Promise<Generation | null> {
    if (gen.mode === 't2i') {
      return await generateImage(gen.prompt, { aspectRatio: gen.aspectRatio || undefined })
    } else if (gen.mode === 't2v') {
      return await generateVideo(gen.prompt, {
        duration: gen.duration || 6,
        aspectRatio: gen.aspectRatio || '16:9',
        resolution: gen.resolution || '720p',
      })
    } else if (gen.mode === 'i2v' && gen.sourceGenerationId) {
      return await generateVideoFromImage(gen.prompt, gen.sourceGenerationId, {
        duration: gen.duration || 6,
        resolution: gen.resolution || '720p',
      })
    } else if (gen.mode === 'i2i' && gen.sourceGenerationId) {
      return await editImage(gen.prompt, gen.sourceGenerationId)
    }
    return null
  }

  /**
   * Upload an image to the media store and retrieve a synthetic generation record.
   */
  async function uploadImage(file: File): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await $fetch<Generation>('/api/media/upload', {
        method: 'POST',
        body: {
          imageBase64: dataUrl,
        },
      })
      return result
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to upload image'
      return null
    } finally {
      generating.value = false
    }
  }

  // Cleanup polling on unmount
  onUnmounted(() => {
    stopAllPolling()
  })

  return {
    generating,
    remixing,
    error,
    generateImage,
    editImage,
    generateVideo,
    generateVideoFromImage,
    pollGeneration,
    stopAllPolling,
    fetchGenerations,
    fetchGeneration,
    deleteGeneration,
    upscaleGeneration,
    retryGeneration,
    remixGeneration,
    uploadImage,
  }
}
