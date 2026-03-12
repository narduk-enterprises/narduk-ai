import type { Generation } from '~/types/generation'
import type { PromptElement } from './usePromptElements'

/**
 * useGenerationForm — orchestrator composable for the generation page.
 * Delegates to focused sub-composables and re-exports a flat API
 * so generate.vue remains a thin consumer.
 *
 * v2: Uses ID-based preset identity, singleton usePromptTags, and the
 * deterministic prompt compiler. No more watcher-based wiring needed.
 */
export function useGenerationForm() {
  const route = useRoute()
  const { defaultAspectRatio, defaultDuration, defaultResolution } = useSettings()

  // ─── Form State ─────────────────────────────────────────────

  const activeTab = ref((route.query.mode as string) || 't2i')
  const prompt = ref((route.query.prompt as string) || '')
  const aspectRatio = ref(defaultAspectRatio.value)
  const duration = ref(defaultDuration.value)
  const resolution = ref(defaultResolution.value)
  const sourceGenerationId = ref((route.query.source as string) || '')

  // ─── Preset State (ID-based) ────────────────────────────────

  const activePresetIds = ref<string[]>([])
  const activePresets = ref<Record<string, string>>({}) // name-based, kept for dual-write
  const activeUserPromptId = ref<string | null>(null)
  const attachedPerson = ref<PromptElement | null>(null)
  const attachedPresets = ref<Record<string, PromptElement | null>>({})

  // ─── Shared Composables ─────────────────────────────────────

  const { elements: allElements, fetchElements } = usePromptElements()

  // Prompt Tags (singleton catalog, local selection)
  const tags = usePromptTags()

  // ─── Derived: ID → Resolved Blocks ──────────────────────────

  /** Full preset blocks with type — used by compiler for scoped tag matching */
  const activePresetBlocks = computed(() => {
    return activePresetIds.value
      .map((id) => allElements.value.find((el) => el.id === id))
      .filter((el): el is PromptElement => el != null)
      .map((el) => ({ type: el.type, content: el.content }))
  })

  /** Flat content strings — used by dispatch for dual-write backward compat */
  const activePresetContents = computed<string[]>(() => {
    return activePresetBlocks.value.map((b) => b.content)
  })

  // ─── Prompt Compiler ────────────────────────────────────────

  const { compiledPrompt, compilePrompt, setBuilderContext } = usePromptCompiler({
    prompt,
    activePresetBlocks,
    selectedTags: tags.selectedTagsList,
  })

  // ─── Generation Dispatch ────────────────────────────────────

  const {
    imageCount,
    latestResult,
    latestResults,
    recentGenerations,
    userImages,
    generating,
    error,
    uploadingSource,
    handleGenerate,
    handleSourceImageUpload,
  } = useGenerationDispatch({
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,
    activePresetIds,
    activePresetContents,
    activePresets,
    activeUserPromptId,
    selectedTags: tags.selectedTagsList,
    compilePrompt,
    recordUsage: tags.recordUsage,
  })

  // ─── Prompt Enhance ─────────────────────────────────────────

  const currentMediaType = computed((): 'image' | 'video' => {
    return activeTab.value === 't2v' || activeTab.value === 'i2v' ? 'video' : 'image'
  })

  const sourceGeneration = computed(() => {
    if (!sourceGenerationId.value) return null
    return userImages.value.find((g: Generation) => g.id === sourceGenerationId.value) || null
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
    activePresetIds,
    generating,
    error,
    latestResult,
    latestResults,
    handleGenerate,
  })

  // ─── Attached Presets (generic for all types) ───────────────

  function attachPreset(type: string, element: PromptElement) {
    const current = type === 'person' ? attachedPerson.value : attachedPresets.value[type]
    if (current?.id === element.id) return
    // Remove old preset's ID before attaching new one
    if (current) {
      activePresetIds.value = activePresetIds.value.filter((id) => id !== current.id)
    }
    if (type === 'person') {
      attachedPerson.value = element
    }
    attachedPresets.value = { ...attachedPresets.value, [type]: element }
    activePresets.value = { ...activePresets.value, [type]: element.name }
    if (!activePresetIds.value.includes(element.id)) {
      activePresetIds.value = [...activePresetIds.value, element.id]
    }
  }

  function detachPreset(type: string) {
    const current = type === 'person' ? attachedPerson.value : attachedPresets.value[type]
    if (current) {
      const { [type]: _, ...rest } = activePresets.value
      activePresets.value = rest
      activePresetIds.value = activePresetIds.value.filter((id) => id !== current.id)
    }
    if (type === 'person') {
      attachedPerson.value = null
    }
    attachedPresets.value = { ...attachedPresets.value, [type]: null }
  }

  // Convenience aliases for backward compat
  function attachPerson(person: PromptElement) {
    attachPreset('person', person)
  }
  function detachPerson() {
    detachPreset('person')
  }

  // ─── Builder Context (from PromptBuilder/Library/Parser) ────

  function handleBuilderResult(
    newPrompt: string,
    presets?: Record<string, string>,
    promptId?: string,
  ) {
    prompt.value = newPrompt
    if (presets) {
      activePresets.value = presets
      // Resolve preset names → IDs
      resolveAndActivatePresets(presets)
    }
    if (promptId) activeUserPromptId.value = promptId
  }

  async function resolveAndActivatePresets(presets: Record<string, string>) {
    // Ensure elements are loaded before resolving names → IDs
    if (!allElements.value.length) {
      await fetchElements()
    }

    const ids: string[] = []
    for (const [type, name] of Object.entries(presets)) {
      // Match by both type and name for precision
      const el =
        allElements.value.find((e) => e.type === type && e.name === name) ||
        allElements.value.find((e) => e.name === name)
      if (el) ids.push(el.id)
    }
    activePresetIds.value = ids
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

  // ─── Return ─────────────────────────────────────────────────

  return {
    // Form state
    activeTab,
    prompt,
    aspectRatio,
    duration,
    resolution,
    sourceGenerationId,
    activePresets,
    activePresetIds,
    activePresetContents,
    setBuilderContext,
    handleBuilderResult,
    imageCount,

    // Attached presets
    attachedPerson,
    attachedPresets,
    attachPerson,
    detachPerson,
    attachPreset,
    detachPreset,

    // Prompt tags (re-exported from singleton)
    tagCategories: tags.categories,
    catalogLoaded: tags.catalogLoaded,
    ensureTagsLoaded: tags.ensureLoaded,
    fetchTags: tags.fetchTags,
    toggleTag: tags.toggleTag,
    isTagSelected: tags.isSelected,
    clearTags: tags.clearTags,
    addTags: tags.addTags,
    selectedTagIds: tags.selectedTagIds,
    selectedTagsList: tags.selectedTagsList,
    allTagsList: tags.allTagsList,
    tagSearchQuery: tags.searchQuery,
    filteredTags: tags.filteredTags,
    tagSnippets: tags.compiledSnippets,

    // Compilation
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
