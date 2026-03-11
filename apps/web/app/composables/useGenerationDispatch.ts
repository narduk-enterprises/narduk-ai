import type { Generation } from '~/types/generation'
import type { QuickModifier } from './useQuickModifiers'

/**
 * useGenerationDispatch — handles generation dispatch (T2I/T2V/I2V/I2I),
 * batch support, video polling with toast notifications, and gallery loading.
 */
export function useGenerationDispatch(deps: {
  activeTab: Ref<string>
  prompt: Ref<string>
  aspectRatio: Ref<string>
  duration: Ref<number>
  resolution: Ref<string>
  sourceGenerationId: Ref<string>
  activePromptElements: Ref<string[]>
  activePresets: Ref<Record<string, string>>
  activeUserPromptId: Ref<string | null>
  activeModifiers: Ref<QuickModifier[]>
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
    activePromptElements,
    activePresets,
    activeUserPromptId,
    activeModifiers,
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
    fetchGenerations,
    uploadImage,
  } = useGenerate()

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

  // ─── Lineage ────────────────────────────────────────────────

  function buildLineage(compiledPrompt: string): string {
    return JSON.stringify({
      presetIds: activePromptElements.value,
      modifierIds: activeModifiers.value.map((m: { id: string }) => m.id),
      userPrompt: prompt.value,
      compiledPrompt,
      activePresets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
    })
  }

  // ─── Generate Handler ──────────────────────────────────────

  async function handleGenerate() {
    const compiled = compilePrompt()
    if (!compiled.trim()) return

    latestResult.value = null
    latestResults.value = []
    error.value = null

    if (activeTab.value === 't2i') {
      const count = imageCount.value

      // Build structured lineage for generation tracking
      const lineage = buildLineage(compiled)

      const opts = {
        aspectRatio: aspectRatio.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
        lineage,
      }

      if (count <= 1) {
        // Single image — original flow
        const result = await generateImage(compiled, opts)
        if (result) {
          latestResult.value = result
          latestResults.value = [result]
          await loadUserImages()
        }
      } else {
        // Batch: fire N parallel requests
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
          await loadUserImages()
        } else {
          error.value = 'All image generations failed. Please try again.'
        }
      }
    } else if (activeTab.value === 't2v') {
      const lineage = buildLineage(compiled)
      const result = await generateVideo(compiled, {
        duration: duration.value,
        aspectRatio: aspectRatio.value,
        resolution: resolution.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
        lineage,
      })
      if (result) {
        startPolling(result)
      }
    } else if (activeTab.value === 'i2v') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const lineage = buildLineage(compiled)
      const result = await generateVideoFromImage(compiled, sourceGenerationId.value, {
        duration: duration.value,
        resolution: resolution.value,
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
        lineage,
      })
      if (result) {
        startPolling(result)
      }
    } else if (activeTab.value === 'i2i') {
      if (!sourceGenerationId.value) {
        error.value = 'Select a source image first'
        return
      }
      const lineage = buildLineage(compiled)
      const result = await editImage(compiled, sourceGenerationId.value, {
        promptElements: activePromptElements.value.length ? activePromptElements.value : undefined,
        presets: Object.keys(activePresets.value).length ? activePresets.value : undefined,
        userPromptId: activeUserPromptId.value || undefined,
        lineage,
      })
      if (result) {
        latestResult.value = result
        latestResults.value = [result]
        await loadUserImages()
      }
    }

    if (recordUsage && activeModifiers.value.length > 0) {
      recordUsage(activeModifiers.value.map((m) => m.id))
    }

    // Clear builder state after successful dispatch so subsequent generations aren't falsely tagged unless specifically re-selected.
    activePromptElements.value = []
    activePresets.value = {}
    activeUserPromptId.value = null
  }

  // ─── Polling ──────────────────────────────────────────────────

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

  // ─── Source Image Upload ────────────────────────────────────
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

  return {
    // State
    imageCount,
    latestResult,
    latestResults,
    recentGenerations,
    userImages,
    generating,
    error,
    uploadingSource,

    // Actions
    loadUserImages,
    handleGenerate,
    handleSourceImageUpload,
    uploadImage,
  }
}
