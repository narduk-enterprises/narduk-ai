import type { Generation } from '~/types/generation'
import type { PromptTag } from '~/types/promptTag'

/**
 * useGenerationDispatch — handles generation dispatch (T2I/T2V/I2V/I2I),
 * batch support, video polling with toast notifications, and gallery loading.
 *
 * v2: Dual-write lineage (IDs) + presets (names) + promptElements (content)
 * for backward compatibility. Does NOT clear state after dispatch.
 */
export function useGenerationDispatch(deps: {
  activeTab: Ref<string>
  prompt: Ref<string>
  aspectRatio: Ref<string>
  duration: Ref<number>
  resolution: Ref<string>
  sourceGenerationId: Ref<string>
  activePresetIds: Ref<string[]>
  activePresetContents: ComputedRef<string[]>
  activePresets: Ref<Record<string, string>>
  activeUserPromptId: Ref<string | null>
  selectedTags: ComputedRef<PromptTag[]>
  selectedModel: Ref<string>
  compilePrompt: () => string
  recordUsage?: (ids: string[]) => Promise<void>
}) {
  const {
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
    selectedTags,
    selectedModel,
    compilePrompt,
    recordUsage,
  } = deps

  const {
    generating,
    error,
    generateImage,
    generateVideo,
    generateVideoFromImage,
    editImage,
    pollGeneration,
    uploadImage,
  } = useGenerate()

  const store = useGenerationsStore()
  const { items, loading, loadingMore, isFinished, doneImages } = storeToRefs(store)
  useGalleryPoller()

  // ─── Batch Count ────────────────────────────────────────────
  const imageCount = ref(1)

  // ─── Generation Results ─────────────────────────────────────
  const latestResult = ref<Generation | null>(null)
  const latestResults = ref<Generation[]>([])

  // ─── Lineage (Dual-Write) ──────────────────────────────────

  function buildLineage(compiledPrompt: string): string {
    return JSON.stringify({
      presetIds: activePresetIds.value,
      tagIds: selectedTags.value.map((t) => t.id),
      userPrompt: prompt.value,
      compiledPrompt,
    })
  }

  /** Legacy: name-based presets for gallery/detail backward compat */
  function buildLegacyPresets(): Record<string, string> | undefined {
    return Object.keys(activePresets.value).length ? activePresets.value : undefined
  }

  /** Legacy: content strings for old generation records */
  function buildLegacyPromptElements(): string[] | undefined {
    return activePresetContents.value.length ? activePresetContents.value : undefined
  }

  // ─── Generate Handler ──────────────────────────────────────

  async function handleGenerate() {
    const compiled = compilePrompt()
    if (!compiled.trim()) return

    latestResult.value = null
    latestResults.value = []
    error.value = null

    // Build shared options (dual-write)
    const lineage = buildLineage(compiled)
    const baseOpts = {
      model: selectedModel.value || undefined,
      promptElements: buildLegacyPromptElements(),
      presets: buildLegacyPresets(),
      userPromptId: activeUserPromptId.value || undefined,
      lineage,
    }

    if (activeTab.value === 't2i') {
      const count = imageCount.value
      const opts = { ...baseOpts, aspectRatio: aspectRatio.value }

      if (count <= 1) {
        const result = await generateImage(compiled, opts)
        if (result) {
          latestResult.value = result
          latestResults.value = [result]
          store.upsert(result)
        }
      } else {
        const settled = await Promise.allSettled(
          Array.from({ length: count }, () => generateImage(compiled, opts)),
        )

        const successes = settled
          .filter((r): r is PromiseFulfilledResult<Generation | null> => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter((v): v is Generation => v !== null)

        if (successes.length > 0) {
          latestResult.value = successes[0]!
          latestResults.value = successes
          for (const s of successes) store.upsert(s)
        } else {
          error.value = 'All image generations failed. Please try again.'
        }
      }
    } else if (activeTab.value === 't2v') {
      const result = await generateVideo(compiled, {
        ...baseOpts,
        duration: duration.value,
        aspectRatio: aspectRatio.value,
        resolution: resolution.value,
      })
      if (result) startPolling(result)
    } else if (activeTab.value === 'i2v') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const result = await generateVideoFromImage(compiled, sourceGenerationId.value, {
        ...baseOpts,
        duration: duration.value,
        resolution: resolution.value,
      })
      if (result) startPolling(result)
    } else if (activeTab.value === 'i2i') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const result = await editImage(compiled, sourceGenerationId.value, baseOpts)
      if (result) {
        latestResult.value = result
        latestResults.value = [result]
        store.upsert(result)
      }
    }

    // Record tag usage
    if (recordUsage && selectedTags.value.length > 0) {
      recordUsage(selectedTags.value.map((t) => t.id))
    }

    // NOTE: We intentionally do NOT clear preset/modifier state after dispatch.
    // Users expect to iterate on the same prompt — clearing was confusing UX.
  }

  // ─── Polling ──────────────────────────────────────────────────

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
      store.upsert(completed)
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
    })
  }

  // ─── Source Image Upload ────────────────────────────────────
  const uploadingSource = ref(false)

  async function handleSourceImageUpload(file: File) {
    if (uploadingSource.value) return
    uploadingSource.value = true
    try {
      const result = await uploadImage(file)
      if (result) {
        sourceGenerationId.value = result.id
        store.upsert(result)
      }
    } catch (e) {
      const err = e as { message?: string }
      error.value = err.message || 'Failed to upload image'
    } finally {
      uploadingSource.value = false
    }
  }

  return {
    // State
    imageCount,
    latestResult,
    latestResults,
    recentGenerations: items,
    loadingGenerations: loading,
    loadingMoreGenerations: loadingMore,
    isGenerationsFinished: isFinished,
    userImages: doneImages,
    generating,
    error,
    uploadingSource,

    // Actions
    handleGenerate,
    handleSourceImageUpload,
    uploadImage,
    loadMoreGenerations: store.loadMore,
  }
}
