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
  } = useGenerate()

  // ─── Form State ─────────────────────────────────────────────

  const activeTab = ref((route.query.mode as string) || 't2i')
  const prompt = ref((route.query.prompt as string) || '')
  const aspectRatio = ref(defaultAspectRatio.value)
  const duration = ref(defaultDuration.value)
  const resolution = ref(defaultResolution.value)
  const sourceGenerationId = ref((route.query.source as string) || '')

  // ─── Chat State ─────────────────────────────────────────────

  const chatMessages = ref<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>([
    {
      role: 'system',
      content:
        'You are Grok, an expert AI assistant specialized in writing prompts for image and video generation models. Help the user brainstorm and refine their ideas into detailed, vivid, and stylistic prompts. Be concise but highly descriptive when suggesting prompts.',
    },
    {
      role: 'assistant',
      content:
        'Hi! I can help you craft the perfect prompt for your next image or video. What are you thinking of creating?',
    },
  ])
  const chatInput = ref('')
  const isChatting = ref(false)

  // ─── Generation Results ─────────────────────────────────────

  const latestResult = ref<Generation | null>(null)
  const recentGenerations = ref<Generation[]>([])
  const userImages = ref<Generation[]>([])

  async function loadUserImages() {
    try {
      const all = await fetchGenerations(100)
      userImages.value = all.filter((g) => g.type === 'image' && g.status === 'done')
      recentGenerations.value = all.slice(0, 6)
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
      const result = await generateImage(prompt.value, aspectRatio.value)
      if (result) {
        latestResult.value = result
        await loadUserImages()
      }
    } else if (activeTab.value === 't2v') {
      const result = await generateVideo(prompt.value, {
        duration: duration.value,
        aspectRatio: aspectRatio.value,
        resolution: resolution.value,
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
      })
      if (result) {
        startPolling(result)
      }
    } else if (activeTab.value === 'i2i') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const result = await editImage(prompt.value, sourceGenerationId.value)
      if (result) {
        latestResult.value = result
        await loadUserImages()
      }
    }
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
    pollGeneration(genRef, (completed) => {
      latestResult.value = completed
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

  function selectSourceImage(id: string) {
    sourceGenerationId.value = id
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

  // ─── Chat Actions ───────────────────────────────────────────

  async function sendChatMessage() {
    if (!chatInput.value.trim() || isChatting.value) return

    const userText = chatInput.value
    chatInput.value = ''
    error.value = null

    chatMessages.value.push({ role: 'user', content: userText })
    isChatting.value = true

    try {
      const result = await $fetch<{ content: string }>('/api/generate/chat', {
        method: 'POST',
        body: {
          messages: chatMessages.value,
        },
      })
      if (result.content) {
        chatMessages.value.push({ role: 'assistant', content: result.content })
      }
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to get chat response'
    } finally {
      isChatting.value = false
    }
  }

  function useMessageAsPrompt(text: string) {
    prompt.value = text
    error.value = null
    activeTab.value = 't2i' // Switch to default generation tab
  }

  return {
    // Form state
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,

    // Chat
    chatMessages,
    chatInput,
    isChatting,

    // Results
    latestResult,
    recentGenerations,
    userImages,

    // Status
    generating,
    enhancing,
    isEnhanceModalOpen,
    enhanceInstructions,
    error,
    charCount,
    isGenerateDisabled,
    resultBadgeColor,
    latestMediaType,
    latestResultError,

    // Actions
    loadUserImages,
    handleGenerate,
    openEnhanceModal,
    enhanceCurrentPrompt,
    selectSourceImage,
    animateLatestImage,
    editLatestImage,
    useGenerationAsSource,
    handleImageUpload,
    removeEnhanceImage,
    enhanceImageBase64,

    // Chat Actions
    sendChatMessage,
    useMessageAsPrompt,
  }
}
