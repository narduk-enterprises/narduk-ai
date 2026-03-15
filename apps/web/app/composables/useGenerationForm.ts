import type { Generation } from '~/types/generation'
import {
  buildCharacterBatchPreviewPrompt,
  buildCharacterBatchRequests,
  getCharacterInputParseErrorMessage,
  parseCharacterInputJson,
  type CharacterBatchImportInput,
} from '~/utils/characterBatch'
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
  const toast = useToast()
  const { defaultAspectRatio, defaultDuration, defaultResolution } = useSettings()
  const generationStore = useGenerationsStore()
  const { fetchGeneration, generateImageBatch } = useGenerate()
  const supportedModes = new Set(['t2i', 't2v', 'i2v', 'i2i'])

  function parseQueryPrompt(value: unknown): string {
    if (typeof value !== 'string') return ''

    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  // ─── Form State ─────────────────────────────────────────────

  const activeTab = ref((route.query.mode as string) || 't2i')
  const prompt = ref(parseQueryPrompt(route.query.prompt))
  const aspectRatio = ref(defaultAspectRatio.value)
  const duration = ref(defaultDuration.value)
  const resolution = ref(defaultResolution.value)
  const sourceGenerationId = ref((route.query.source as string) || '')

  watch(
    () => route.query.mode,
    (mode) => {
      if (typeof mode === 'string' && supportedModes.has(mode) && mode !== activeTab.value) {
        activeTab.value = mode
      }
    },
  )

  watch(
    () => route.query.source,
    (source) => {
      const nextSource = typeof source === 'string' ? source : ''
      if (nextSource !== sourceGenerationId.value) {
        sourceGenerationId.value = nextSource
      }
    },
  )

  watch(
    () => route.query.prompt,
    (queryPrompt) => {
      const nextPrompt = parseQueryPrompt(queryPrompt)
      if (nextPrompt !== prompt.value) {
        prompt.value = nextPrompt
      }
    },
  )

  // ─── Model Selection ────────────────────────────────────────
  const { imageModels, videoModels, preferredImageModel, preferredVideoModel } = useXaiModels()
  const selectedImageModel = ref<string>(
    preferredImageModel.value || imageModels.value[0] || 'grok-imagine-image',
  )
  const selectedVideoModel = ref<string>(
    preferredVideoModel.value || videoModels.value[0] || 'grok-imagine-video',
  )

  watchEffect(() => {
    if (
      imageModels.value.length &&
      (!selectedImageModel.value || !imageModels.value.includes(selectedImageModel.value))
    ) {
      selectedImageModel.value = preferredImageModel.value || imageModels.value[0]!
    }

    if (
      videoModels.value.length &&
      (!selectedVideoModel.value || !videoModels.value.includes(selectedVideoModel.value))
    ) {
      selectedVideoModel.value = preferredVideoModel.value || videoModels.value[0]!
    }
  })

  const selectedModel = computed(() => {
    return activeTab.value === 't2v' || activeTab.value === 'i2v'
      ? selectedVideoModel.value
      : selectedImageModel.value
  })

  // ─── Preset State (ID-based) ────────────────────────────────

  const activePresetIds = ref<string[]>([])
  const activePresets = ref<Record<string, string>>({}) // name-based, kept for dual-write
  const activeUserPromptId = ref<string | null>(null)
  const attachedPerson = ref<PromptElement | null>(null)
  const attachedPresets = ref<Record<string, PromptElement | null>>({})

  // ─── Shared Composables ─────────────────────────────────────

  const { elements: allElements, ensureLoaded: ensureElementsLoaded } = usePromptElements()

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

  const {
    compiledPrompt,
    prosePrompt,
    compilePrompt,
    compileStructured,
    promptLength,
    promptWarnings,
    setBuilderContext,
  } = usePromptCompiler({
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
    loadingGenerations,
    loadingMoreGenerations,
    isGenerationsFinished,
    userImages,
    generating,
    error,
    uploadingSource,
    handleGenerate: dispatchGenerate,
    handleSourceImageUpload,
    loadMoreGenerations,
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
    selectedModel,
    compilePrompt,
    recordUsage: tags.recordUsage,
  })

  // ─── Test JSON Import / Batch Submission ───────────────────

  const isCharacterJsonModalOpen = ref(false)
  const characterJsonInput = ref('')
  const characterJsonError = ref<string | null>(null)
  const parsingCharacterJson = ref(false)
  const batchGenerating = ref(false)
  const importedCharacterBatch = ref<CharacterBatchImportInput | null>(null)
  const importedCharacterBatchPreview = ref('')

  const hasCharacterBatchImport = computed(() => importedCharacterBatch.value !== null)
  const isCharacterBatchReady = computed(
    () => importedCharacterBatch.value !== null && activeTab.value === 't2i',
  )
  const characterBatchRequestCount = computed(() => {
    if (!importedCharacterBatch.value) return 0
    return buildCharacterBatchRequests(importedCharacterBatch.value).length
  })

  function clearCharacterJsonImport() {
    importedCharacterBatch.value = null
    importedCharacterBatchPreview.value = ''
    characterJsonError.value = null
  }

  function clearStructuredInputsForCharacterBatch() {
    activePresetIds.value = []
    activePresets.value = {}
    activeUserPromptId.value = null
    attachedPerson.value = null
    attachedPresets.value = {}
    sourceGenerationId.value = ''
    tags.clearTags()
  }

  async function parseCharacterJsonImport() {
    if (!characterJsonInput.value.trim() || parsingCharacterJson.value) return

    parsingCharacterJson.value = true
    characterJsonError.value = null

    try {
      const parsed = parseCharacterInputJson(characterJsonInput.value)
      const previewPrompt = buildCharacterBatchPreviewPrompt(parsed)
      const requestCount = buildCharacterBatchRequests(parsed).length
      const importedItemCount = Array.isArray(parsed) ? parsed.length : parsed.characters.length

      importedCharacterBatch.value = parsed
      importedCharacterBatchPreview.value = previewPrompt
      activeTab.value = 't2i'
      clearStructuredInputsForCharacterBatch()
      prompt.value = previewPrompt
      latestResult.value = null
      latestResults.value = []
      error.value = null
      isCharacterJsonModalOpen.value = false

      toast.add({
        title: 'Character JSON Imported',
        description: `${importedItemCount} item${importedItemCount === 1 ? '' : 's'} compiled into ${requestCount} batch request${requestCount === 1 ? '' : 's'}.`,
        color: 'success',
        icon: 'i-lucide-file-json',
      })
    } catch (err) {
      characterJsonError.value = getCharacterInputParseErrorMessage(err)
    } finally {
      parsingCharacterJson.value = false
    }
  }

  async function handleGenerate() {
    if (isGenerating.value) return

    if (hasCharacterBatchImport.value) {
      if (!isCharacterBatchReady.value || !importedCharacterBatch.value) return

      error.value = null
      latestResult.value = null
      latestResults.value = []

      const requests = buildCharacterBatchRequests(importedCharacterBatch.value).map((request) => ({
        prompt: request.prompt,
        model: request.requestedModel || selectedImageModel.value,
      }))

      batchGenerating.value = true
      try {
        const { successes, failures } = await generateImageBatch(requests, {
          aspectRatio: aspectRatio.value,
        })

        if (successes.length > 0) {
          latestResult.value = successes[0]!
          latestResults.value = successes
          for (const success of successes) {
            generationStore.upsert(success)
          }

          toast.add({
            title:
              failures > 0
                ? 'Imported Images Generated With Failures'
                : 'Imported Images Generated',
            description:
              failures > 0
                ? `${successes.length} image${successes.length === 1 ? '' : 's'} succeeded and ${failures} failed.`
                : `${successes.length} imported image${successes.length === 1 ? '' : 's'} generated with xAI.`,
            color: failures > 0 ? 'warning' : 'success',
            icon: failures > 0 ? 'i-lucide-alert-triangle' : 'i-lucide-images',
          })
        }
      } finally {
        batchGenerating.value = false
      }

      return
    }

    await dispatchGenerate()
  }

  // ─── Prompt Enhance ─────────────────────────────────────────

  const currentMediaType = computed((): 'image' | 'video' => {
    return activeTab.value === 't2v' || activeTab.value === 'i2v' ? 'video' : 'image'
  })

  const hydratedSourceGeneration = ref<Generation | null>(null)
  let sourceLookupToken = 0

  watch(
    sourceGenerationId,
    async (sourceId) => {
      if (!sourceId) {
        hydratedSourceGeneration.value = null
        return
      }

      // Look up from store directly — avoid depending on doneImages computed
      const store = useGenerationsStore()
      const existing =
        store.items.find((g: Generation) => g.id === sourceId && g.status === 'done') || null
      if (existing) {
        hydratedSourceGeneration.value = existing
        return
      }

      const currentLookup = ++sourceLookupToken

      try {
        const fetched = await fetchGeneration(sourceId)
        if (currentLookup !== sourceLookupToken) return

        hydratedSourceGeneration.value = fetched
        store.upsert(fetched)
      } catch {
        if (currentLookup !== sourceLookupToken) return
        hydratedSourceGeneration.value = null
      }
    },
    { immediate: true },
  )

  const sourceGeneration = computed(() => {
    if (!sourceGenerationId.value) return null
    const store = useGenerationsStore()
    return (
      store.items.find(
        (g: Generation) => g.id === sourceGenerationId.value && g.status === 'done',
      ) ||
      (hydratedSourceGeneration.value?.id === sourceGenerationId.value
        ? hydratedSourceGeneration.value
        : null)
    )
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

  watch(prompt, (nextPrompt) => {
    if (
      hasCharacterBatchImport.value &&
      importedCharacterBatchPreview.value &&
      nextPrompt !== importedCharacterBatchPreview.value
    ) {
      clearCharacterJsonImport()
    }
  })

  // ─── Attached Presets (generic for all types) ───────────────

  function attachPreset(type: string, element: PromptElement) {
    if (hasCharacterBatchImport.value) clearCharacterJsonImport()
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
    if (hasCharacterBatchImport.value) clearCharacterJsonImport()
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
    if (hasCharacterBatchImport.value) clearCharacterJsonImport()
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
      await ensureElementsLoaded()
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
    if (hasCharacterBatchImport.value) clearCharacterJsonImport()
    activeTab.value = 'i2v'
    sourceGenerationId.value = gen.id
  }

  function useCompiledPromptAsDraft() {
    if (hasCharacterBatchImport.value) {
      clearCharacterJsonImport()
      activeUserPromptId.value = null
      toast.add({
        title: 'JSON Batch Import Cleared',
        description: 'The imported test batch was cleared so the prompt can be edited normally.',
        color: 'info',
        icon: 'i-lucide-file-pen-line',
      })
      return
    }

    const nextPrompt = prosePrompt.value.trim()
    const hadStructuredInputs =
      activePresetIds.value.length > 0 || tags.selectedTagsList.value.length > 0

    if (!nextPrompt) return

    prompt.value = nextPrompt
    activePresetIds.value = []
    activePresets.value = {}
    activeUserPromptId.value = null
    attachedPerson.value = null
    attachedPresets.value = {}
    tags.clearTags()

    if (hadStructuredInputs) {
      toast.add({
        title: 'Final Prompt Loaded',
        description: 'Presets and modifiers were flattened into the prompt draft for editing.',
        color: 'success',
        icon: 'i-lucide-file-pen-line',
      })
    }
  }

  // ─── Computed ───────────────────────────────────────────────

  const charCount = computed(() => prosePrompt.value.length)
  const isGenerating = computed(() => generating.value || batchGenerating.value)
  const isGenerateDisabled = computed(() => {
    if (hasCharacterBatchImport.value && !isCharacterBatchReady.value) {
      return true
    }

    if (isCharacterBatchReady.value) {
      return isGenerating.value
    }

    return !prosePrompt.value.trim() || isGenerating.value
  })

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

    // Model selection
    selectedImageModel,
    selectedVideoModel,

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
    compileStructured,
    compiledPrompt,
    prosePrompt,
    promptLength,
    promptWarnings,

    // Test JSON import
    isCharacterJsonModalOpen,
    characterJsonInput,
    characterJsonError,
    parsingCharacterJson,
    batchGenerating,
    hasCharacterBatchImport,
    isCharacterBatchReady,
    characterBatchRequestCount,

    // Results
    latestResult,
    latestResults,
    recentGenerations,
    loadingGenerations,
    loadingMoreGenerations,
    isGenerationsFinished,
    loadMoreGenerations,
    userImages,

    // Status
    generating,
    isGenerating,
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
    parseCharacterJsonImport,
    clearCharacterJsonImport,
    handleFeelingLucky,
    openEnhanceModal,
    enhanceCurrentPrompt,
    handleSourceImageUpload,
    animateLatestImage,
    editLatestImage,
    useGenerationAsSource,
    useCompiledPromptAsDraft,
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
