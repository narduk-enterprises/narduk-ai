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

  // ─── Batch Count ────────────────────────────────────────────

  const imageCount = ref(1)

  // ─── Generation Results ─────────────────────────────────────

  const latestResult = ref<Generation | null>(null)
  const latestResults = ref<Generation[]>([])
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
    latestResults.value = []
    error.value = null

    if (activeTab.value === 't2i') {
      const count = imageCount.value
      const opts = {
        aspectRatio: aspectRatio.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
      }

      if (count <= 1) {
        // Single image — original flow
        const result = await generateImage(prompt.value, opts)
        if (result) {
          latestResult.value = result
          latestResults.value = [result]
          await loadUserImages()
        }
      } else {
        // Batch: fire N parallel requests
        const settled = await Promise.allSettled(
          Array.from({ length: count }, () => generateImage(prompt.value, opts)),
        )

        const successes = settled
          .filter((r): r is PromiseFulfilledResult<Generation | null> => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter((v): v is Generation => v !== null)

        if (successes.length > 0) {
          latestResult.value = successes[0]!
          latestResults.value = successes
          await loadUserImages()
        } else {
          error.value = 'All image generations failed. Please try again.'
        }
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
        latestResults.value = [result]
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

  // ─── Feeling Lucky ──────────────────────────────────────────
  const feelingLucky = ref(false)
  const { elements: luckyElements, fetchElements: fetchLuckyElements } = usePromptElements()

  async function handleFeelingLucky() {
    if (feelingLucky.value || generating.value) return
    feelingLucky.value = true
    error.value = null
    latestResult.value = null
    latestResults.value = []

    try {
      // Ensure elements are loaded
      if (!luckyElements.value.length) {
        await fetchLuckyElements()
      }

      const allElements = luckyElements.value
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
      // Store names in picked (for DB storage), content in pickedContent (for prompt composition)
      const picked: Record<string, string> = {}
      const pickedContent: string[] = []

      if (byType.person?.length) {
        const person = byType.person[Math.floor(Math.random() * byType.person.length)]!
        picked.person = person.name
        pickedContent.push(`person: ${person.content}`)
      }

      const otherTypes = ['scene', 'framing', 'action', 'style'].filter((t) => byType[t]?.length)
      // Shuffle and pick 1-2 random other types
      const shuffled = otherTypes.sort(() => Math.random() - 0.5)
      const pickCount = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
      for (let i = 0; i < pickCount; i++) {
        const type = shuffled[i]!
        const el = byType[type]![Math.floor(Math.random() * byType[type]!.length)]!
        picked[type] = el.name
        pickedContent.push(`${type}: ${el.content}`)
      }

      if (!pickedContent.length) {
        error.value = 'No suitable presets found.'
        return
      }

      // Generate prompt via Grok with strong photorealism guardrails
      const isVideo = activeTab.value === 't2v' || activeTab.value === 'i2v'
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

      // Set the prompt and presets, then auto-generate
      prompt.value = luckyPrompt
      activePresets.value = picked
      activePromptElements.value = Object.values(picked)

      await handleGenerate()
    } catch (e) {
      console.error('Feeling Lucky failed:', e)
      error.value = 'Feeling Lucky failed. Try again!'
    } finally {
      feelingLucky.value = false
    }
  }

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
    imageCount,

    // Results
    latestResult,
    latestResults,
    recentGenerations,
    userImages,

    // Status
    generating,
    enhancing,
    upscaling,
    feelingLucky,
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
    handleFeelingLucky,
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
