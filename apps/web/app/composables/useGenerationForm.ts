import type { Generation } from '~/types/generation'

/**
 * useGenerationForm — encapsulates the generation page form state,
 * mode switching, generation dispatch, result management, and polling.
 *
 * Extracted from generate.vue to keep the page as a thin orchestrator.
 */
export function useGenerationForm() {
  const route = useRoute()
  const { defaultAspectRatio, defaultDuration, defaultResolution } = useSettings()
  const {
    generating,
    error,
    generateImage,
    generateVideo,
    generateVideoFromImage,
    editImage,
    pollGeneration,
    fetchGenerations,
    uploadImage,
  } = useGenerate()

  // ─── Form State ─────────────────────────────────────────────

  const activeTab = ref((route.query.mode as string) || 't2i')
  const prompt = ref((route.query.prompt as string) || '')
  const aspectRatio = ref(defaultAspectRatio.value)
  const duration = ref(defaultDuration.value)
  const resolution = ref(defaultResolution.value)
  const sourceGenerationId = ref((route.query.source as string) || '')

  // Storage for builder context
  const activePromptElements = ref<string[]>([])
  const activePresets = ref<Record<string, string>>({})
  const activeUserPromptId = ref<string | null>(null)

  function setBuilderContext(
    newPrompt: string,
    presets: Record<string, string>,
    promptId?: string,
  ) {
    prompt.value = newPrompt
    activePromptElements.value = Object.values(presets).filter(Boolean) as string[]
    activePresets.value = presets
    activeUserPromptId.value = promptId || null
  }

  // ─── Generation Results ─────────────────────────────────────

  const latestResult = ref<Generation | null>(null)
  const recentGenerations = ref<Generation[]>([])
  const userImages = ref<Generation[]>([])

  async function loadUserImages() {
    try {
      const all = await fetchGenerations(100)
      userImages.value = all.filter((g) => g.type === 'image' && g.status === 'done')
      recentGenerations.value = all.slice(0, 20)
    } catch {
      // silent
    }
  }

  // ─── Generate Handlers ──────────────────────────────────────

  async function handleGenerate() {
    if (!prompt.value.trim()) return

    latestResult.value = null
    error.value = null

    if (activeTab.value === 't2i') {
      const result = await generateImage(prompt.value, {
        aspectRatio: aspectRatio.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
      })
      if (result) {
        latestResult.value = result
        await loadUserImages()
      }
    } else if (activeTab.value === 't2v') {
      const result = await generateVideo(prompt.value, {
        duration: duration.value,
        aspectRatio: aspectRatio.value,
        resolution: resolution.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
      })
      if (result) {
        startPolling(result)
      }
    } else if (activeTab.value === 'i2v') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const result = await generateVideoFromImage(prompt.value, sourceGenerationId.value, {
        duration: duration.value,
        resolution: resolution.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
      })
      if (result) {
        startPolling(result)
      }
    } else if (activeTab.value === 'i2i') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const result = await editImage(prompt.value, sourceGenerationId.value, {
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
      })
      if (result) {
        latestResult.value = result
        await loadUserImages()
      }
    }

    // Clear builder state after successful dispatch so subsequent generations aren't falsely tagged unless specifically re-selected.
    activePromptElements.value = []
    activePresets.value = {}
    activeUserPromptId.value = null
  }

  /**
   * Start polling a video generation result.
   * Uses a shared pollingRef to avoid calling ref()/watch() conditionally.
   */
  const _pollingRef = ref<Generation | null>(null)

  watch(_pollingRef, (updated) => {
    if (updated) latestResult.value = updated
  })

  function startPolling(result: Generation) {
    latestResult.value = result
    _pollingRef.value = result
    const genRef = _pollingRef as Ref<Generation>
    const toast = useToast()
    pollGeneration(genRef, (completed) => {
      latestResult.value = completed
      if (completed.status === 'failed' || completed.status === 'expired') {
        const errorMsg = (() => {
          if (!completed.metadata) return null
          try {
            const meta = JSON.parse(completed.metadata)
            return meta.error?.message || (typeof meta.error === 'string' ? meta.error : null)
          } catch {
            return null
          }
        })()
        toast.add({
          title: completed.status === 'expired' ? 'Video Expired' : 'Video Generation Failed',
          description: errorMsg || 'Something went wrong. Please try again.',
          color: 'error',
          icon: 'i-lucide-alert-triangle',
        })
      } else if (completed.status === 'done') {
        toast.add({
          title: 'Video Ready!',
          description: 'Your video has finished generating.',
          color: 'success',
          icon: 'i-lucide-check-circle',
        })
      }
      loadUserImages()
    })
  }

  // ─── Computed ───────────────────────────────────────────────

  const charCount = computed(() => prompt.value.length)
  const isGenerateDisabled = computed(() => !prompt.value.trim() || generating.value)

  const resultBadgeColor = computed(() => {
    if (!latestResult.value) return 'neutral'
    if (latestResult.value.status === 'done') return 'success'
    if (latestResult.value.status === 'pending') return 'warning'
    return 'error'
  })

  const latestMediaType = computed(() => {
    return (latestResult.value?.type ?? 'image') as 'image' | 'video'
  })

  const currentMediaType = computed((): 'image' | 'video' => {
    return activeTab.value === 't2v' || activeTab.value === 'i2v' ? 'video' : 'image'
  })

  const latestResultError = computed(() => {
    if (!latestResult.value?.metadata) return null
    try {
      const meta = JSON.parse(latestResult.value.metadata)
      if (meta.error?.message) return meta.error.message
      if (typeof meta.error === 'string') return meta.error
      return null
    } catch {
      return null
    }
  })

  // ─── Actions ────────────────────────────────────────────────

  const uploadingSource = ref(false)

  async function handleSourceImageUpload(file: File) {
    if (uploadingSource.value) return
    uploadingSource.value = true
    try {
      const result = await uploadImage(file)
      if (result) {
        sourceGenerationId.value = result.id
        await loadUserImages()
      }
    } catch (e) {
      const err = e as { message?: string }
      error.value = err.message || 'Failed to upload image'
    } finally {
      uploadingSource.value = false
    }
  }

  function animateLatestImage() {
    activeTab.value = 'i2v'
    sourceGenerationId.value = latestResult.value!.id
  }

  function editLatestImage() {
    activeTab.value = 'i2i'
    sourceGenerationId.value = latestResult.value!.id
  }

  function useGenerationAsSource(gen: Generation) {
    activeTab.value = 'i2v'
    sourceGenerationId.value = gen.id
  }

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
      const result = await $fetch<{ enhancedPrompt: string }>('/api/generate/enhance-prompt', {
        method: 'POST',
        body: {
          prompt: prompt.value,
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
  const sourceGeneration = computed(() => {
    if (!sourceGenerationId.value) return null
    return userImages.value.find((g) => g.id === sourceGenerationId.value) || null
  })

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
          // We do not need to send imageBase64 here since we are just deriving a new prompt based on the old one + instructions.
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
      // Add upscaled image to recent generations
      recentGenerations.value.unshift(result)
      latestResult.value = result
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upscale failed'
      error.value = message
    } finally {
      upscaling.value = false
    }
  }

  // ─── Chat Actions Removed (Moved to useChatForm) ────────────

  return {
    // Form state
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,
    activePresets,
    setBuilderContext,

    // Results
    latestResult,
    recentGenerations,
    userImages,

    // Status
    generating,
    enhancing,
    upscaling,
    isEnhanceModalOpen,
    enhanceInstructions,
    error,
    charCount,
    isGenerateDisabled,
    resultBadgeColor,
    latestMediaType,
    currentMediaType,
    latestResultError,

    // Actions
    loadUserImages,
    handleGenerate,
    openEnhanceModal,
    enhanceCurrentPrompt,
    handleSourceImageUpload,
    animateLatestImage,
    editLatestImage,
    useGenerationAsSource,
    upscaleGeneration,
    handleImageUpload,
    removeEnhanceImage,
    enhanceImageBase64,
    uploadingSource,
    sourceGeneration,
    i2iInstructions,
    generatingI2IPrompt,
    generateI2IPrompt,
  }
}
