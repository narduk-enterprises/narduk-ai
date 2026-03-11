import type { Generation } from '~/types/generation'
import type { PromptElement } from './usePromptElements'
import type { QuickModifier } from './useQuickModifiers'

/**
 * useGenerationForm — orchestrator composable for the generation page.
 * Delegates to focused sub-composables and re-exports a flat API
 * so generate.vue remains a thin consumer with zero breaking changes.
 */
export function useGenerationForm(recordUsage?: (ids: string[]) => Promise<void>) {
  const route = useRoute()
  const { defaultAspectRatio, defaultDuration, defaultResolution } = useSettings()

  // ─── Form State ─────────────────────────────────────────────

  const activeTab = ref((route.query.mode as string) || 't2i')
  const prompt = ref((route.query.prompt as string) || '')
  const aspectRatio = ref(defaultAspectRatio.value)
  const duration = ref(defaultDuration.value)
  const resolution = ref(defaultResolution.value)
  const sourceGenerationId = ref((route.query.source as string) || '')

  // Preset + modifier state (shared across sub-composables)
  const activePromptElements = ref<string[]>([])
  const activePresets = ref<Record<string, string>>({})
  const activeUserPromptId = ref<string | null>(null)
  const attachedPerson = ref<PromptElement | null>(null)
  const modifierSnippets = ref('')
  const activeModifiers = ref<QuickModifier[]>([])

  // ─── Sub-composables ────────────────────────────────────────

  const {
    setBuilderContext,
    setModifierDependencies,
    autoSelectModifiersForPreset,
    compilePrompt,
    compiledPrompt,
    onSetDynamicModifiers,
  } = usePromptCompiler({
    prompt,
    activePromptElements,
    activePresets,
    activeUserPromptId,
    attachedPerson,
    activeModifiers,
  })

  const {
    imageCount,
    latestResult,
    latestResults,
    recentGenerations,
    userImages,
    generating,
    error,
    uploadingSource,
    loadUserImages,
    handleGenerate,
    handleSourceImageUpload,
  } = useGenerationDispatch({
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,
    activePromptElements,
    activePresets,
    activeUserPromptId,
    activeModifiers,
    compilePrompt,
    recordUsage,
  })

  const currentMediaType = computed((): 'image' | 'video' => {
    return activeTab.value === 't2v' || activeTab.value === 'i2v' ? 'video' : 'image'
  })

  const sourceGeneration = computed(() => {
    if (!sourceGenerationId.value) return null
    return userImages.value.find((g) => g.id === sourceGenerationId.value) || null
  })

  const {
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
  } = usePromptEnhance({
    prompt,
    error,
    compilePrompt,
    currentMediaType,
    sourceGeneration,
    recentGenerations,
    latestResult,
  })

  const { feelingLucky, handleFeelingLucky } = useFeelingLucky({
    activeTab,
    prompt,
    activePresets,
    activePromptElements,
    generating,
    error,
    latestResult,
    latestResults,
    handleGenerate,
  })

  // ─── Attached Person ────────────────────────────────────────

  function attachPerson(person: PromptElement) {
    if (attachedPerson.value?.id === person.id) return
    attachedPerson.value = person
    activePresets.value = { ...activePresets.value, person: person.name }
    if (!activePromptElements.value.includes(person.content)) {
      activePromptElements.value = [...activePromptElements.value, person.content]
    }
    autoSelectModifiersForPreset(person.content)
  }

  function detachPerson() {
    if (attachedPerson.value) {
      const { person: _, ...rest } = activePresets.value
      activePresets.value = rest
      activePromptElements.value = activePromptElements.value.filter(
        (c) => c !== attachedPerson.value!.content,
      )
    }
    attachedPerson.value = null
    const setDynamic = onSetDynamicModifiers()
    if (setDynamic) {
      setDynamic([]) // Clear dynamic modifiers when detaching person
    }
  }

  // ─── Simple Navigation Actions ──────────────────────────────

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

  // ─── Computed ───────────────────────────────────────────────

  const charCount = computed(() => compiledPrompt.value.length)
  const isGenerateDisabled = computed(() => !compiledPrompt.value.trim() || generating.value)

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

  // ─── Return (flat API — zero breaking changes to generate.vue) ──

  return {
    // Form state
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,
    activePresets,
    activePromptElements,
    setBuilderContext,
    imageCount,

    // Attached person & modifiers
    attachedPerson,
    modifierSnippets,
    activeModifiers,
    attachPerson,
    detachPerson,
    compilePrompt,
    compiledPrompt,

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
    setModifierDependencies,
  }
}
