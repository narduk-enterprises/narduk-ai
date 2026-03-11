import type { Generation } from '~/types/generation'

/**
 * Composable for AI media generation.
 * Provides methods for generating images/videos and managing polling state.
 */
export function useGenerate() {
  const generating = ref(false)
  const error = ref<string | null>(null)
  const pollingIntervals = ref<Map<string, ReturnType<typeof setInterval>>>(new Map())

  /**
   * Generate an image from text (T2I).
   */
  async function generateImage(prompt: string, aspectRatio?: string): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/image', {
        method: 'POST',
        body: { prompt, aspectRatio },
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
  async function editImage(prompt: string, sourceGenerationId: string): Promise<Generation | null> {
    generating.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/image-edit', {
        method: 'POST',
        body: { prompt, sourceGenerationId },
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
    options?: { duration?: number; aspectRatio?: string; resolution?: string },
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
    options?: { duration?: number; resolution?: string },
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

    const executePoll = async () => {
      try {
        const result = await $fetch<Generation>(`/api/generate/poll/${requestId}`)
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
        pollingIntervals.value.delete(requestId)
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
  async function fetchGenerations(limit = 50, offset = 0): Promise<Generation[]> {
    return await $fetch<Generation[]>('/api/generations', {
      query: { limit, offset },
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
   * Retry a failed/expired generation by re-dispatching based on mode.
   */
  async function retryGeneration(gen: Generation): Promise<Generation | null> {
    if (gen.mode === 't2i') {
      return await generateImage(gen.prompt, gen.aspectRatio || undefined)
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

  // Cleanup polling on unmount
  onUnmounted(() => {
    stopAllPolling()
  })

  return {
    generating,
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
  }
}
