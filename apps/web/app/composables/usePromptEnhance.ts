import type { Generation } from '~/types/generation'

/**
 * usePromptEnhance — encapsulates prompt enhancement, I2I prompt generation,
 * enhance-image upload, and upscale functionality.
 */
export function usePromptEnhance(deps: {
  prompt: Ref<string>
  error: Ref<string | null>
  compilePrompt: () => string
  currentMediaType: ComputedRef<'image' | 'video'>
  sourceGeneration: ComputedRef<Generation | null>
  latestResult: Ref<Generation | null>
}) {
  const {
    prompt,
    error,
    compilePrompt,
    currentMediaType,
    sourceGeneration,
    latestResult,
  } = deps

  // ─── Enhance Modal ────────────────────────────────────────────
  const isEnhanceModalOpen = ref(false)
  const enhanceInstructions = ref('')
  const enhanceImageBase64 = ref<string | null>(null)
  const enhancing = ref(false)

  function openEnhanceModal() {
    if (!prompt.value.trim()) return
    isEnhanceModalOpen.value = true
  }

  async function handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      error.value = 'Image size must be less than 5MB'
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      enhanceImageBase64.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  function removeEnhanceImage() {
    enhanceImageBase64.value = null
  }

  async function enhanceCurrentPrompt() {
    if (!prompt.value.trim() || enhancing.value) return

    enhancing.value = true
    error.value = null

    try {
      const compiled = compilePrompt()
      const result = await $fetch<{ enhancedPrompt: string }>('/api/generate/enhance-prompt', {
        method: 'POST',
        body: {
          prompt: compiled,
          instructions: enhanceInstructions.value || undefined,
          imageBase64: enhanceImageBase64.value || undefined,
          mediaType: currentMediaType.value,
        },
      })
      if (result.enhancedPrompt) {
        prompt.value = result.enhancedPrompt
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to enhance prompt'
    } finally {
      enhancing.value = false
      isEnhanceModalOpen.value = false
      enhanceImageBase64.value = null
      enhanceInstructions.value = ''
    }
  }

  // ─── Image-to-Image Prompt Generation ───────────────────────
  const i2iInstructions = ref('')
  const generatingI2IPrompt = ref(false)

  async function generateI2IPrompt() {
    if (!sourceGeneration.value || generatingI2IPrompt.value) return

    generatingI2IPrompt.value = true
    error.value = null

    try {
      const result = await $fetch<{ enhancedPrompt: string }>('/api/generate/enhance-prompt', {
        method: 'POST',
        body: {
          prompt: sourceGeneration.value.prompt,
          instructions: i2iInstructions.value || undefined,
        },
      })
      if (result.enhancedPrompt) {
        prompt.value = result.enhancedPrompt
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to generate I2I prompt'
    } finally {
      generatingI2IPrompt.value = false
    }
  }

  // ─── Upscale ──────────────────────────────────────────────────
  const upscaling = ref(false)

  async function upscaleGeneration(generationId: string) {
    if (upscaling.value) return
    upscaling.value = true
    error.value = null
    try {
      const result = await $fetch<Generation>('/api/generate/upscale', {
        method: 'POST',
        body: { generationId },
      })
      // Add via store for proper deduplication and reactivity
      const store = useGenerationsStore()
      store.upsert(result)
      latestResult.value = result
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upscale failed'
      error.value = message
    } finally {
      upscaling.value = false
    }
  }

  return {
    isEnhanceModalOpen,
    enhanceInstructions,
    enhanceImageBase64,
    enhancing,
    openEnhanceModal,
    handleImageUpload,
    removeEnhanceImage,
    enhanceCurrentPrompt,
    i2iInstructions,
    generatingI2IPrompt,
    generateI2IPrompt,
    upscaling,
    upscaleGeneration,
  }
}
