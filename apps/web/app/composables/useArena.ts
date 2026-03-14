import type { Generation } from '~/types/generation'
import type {
  CompareSourceContext,
  ImageComparisonVoteResponse,
} from '~/types/imageComparison'

interface ArenaPair {
  left: Generation
  right: Generation
}

interface SeedBatch {
  batchId: string
  label: string | null
  dimension: string
  count: number
  createdAt: string
  previewUrl: string | null
}

/**
 * Composable for rapid-fire Arena mode comparisons.
 *
 * Loads images from a batch (or all images), generates a shuffled pair queue,
 * and auto-advances after each vote. Designed for quick preset tuning.
 */
export function useArena() {
  const toast = useToast()
  const { fetchGenerations, fetchImageComparison, submitImageComparison } = useGenerate()
  const store = useGenerationsStore()

  const arenaActive = ref(false)
  const arenaImages = ref<Generation[]>([])
  const arenaPairs = ref<ArenaPair[]>([])
  const currentPairIndex = ref(0)
  const loading = ref(false)
  const voting = ref(false)
  const batchId = ref<string | null>(null)
  const skippedCount = ref(0)

  // Batch list for selector
  const batches = ref<SeedBatch[]>([])
  const loadingBatches = ref(false)

  const currentPair = computed<ArenaPair | null>(() => {
    if (currentPairIndex.value >= arenaPairs.value.length) return null
    return arenaPairs.value[currentPairIndex.value] ?? null
  })

  const arenaStats = computed(() => ({
    totalPairs: arenaPairs.value.length,
    completed: currentPairIndex.value,
    remaining: Math.max(0, arenaPairs.value.length - currentPairIndex.value),
    skipped: skippedCount.value,
  }))

  const arenaComplete = computed(() =>
    arenaActive.value && arenaPairs.value.length > 0 && currentPair.value === null,
  )

  const progressPercent = computed(() => {
    if (arenaPairs.value.length === 0) return 0
    return Math.round((currentPairIndex.value / arenaPairs.value.length) * 100)
  })

  /**
   * Generate all unique pairs from an array of images, shuffled randomly.
   */
  function generateShuffledPairs(images: Generation[]): ArenaPair[] {
    const pairs: ArenaPair[] = []
    for (let i = 0; i < images.length; i++) {
      for (let j = i + 1; j < images.length; j++) {
        const left = images[i]!
        const right = images[j]!
        // Randomly assign left/right so there's no positional bias
        if (Math.random() < 0.5) {
          pairs.push({ left, right })
        }
        else {
          pairs.push({ left: right, right: left })
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = pairs[i]!
      pairs[i] = pairs[j]!
      pairs[j] = temp
    }

    return pairs
  }

  /**
   * Filter out pairs that have already been compared.
   */
  async function filterUncomparedPairs(pairs: ArenaPair[]): Promise<ArenaPair[]> {
    const uncompared: ArenaPair[] = []

    // Check in batches to avoid too many sequential requests
    const batchSize = 20
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize)
      const checks = await Promise.allSettled(
        batch.map(async (pair) => {
          const existing = await fetchImageComparison(pair.left.id, pair.right.id)
          return { pair, existing }
        }),
      )

      for (const result of checks) {
        if (result.status === 'fulfilled' && !result.value.existing) {
          uncompared.push(result.value.pair)
        }
      }
    }

    return uncompared
  }

  /**
   * Load available seed batches for the batch picker.
   */
  async function loadBatches() {
    loadingBatches.value = true
    try {
      batches.value = await $fetch<SeedBatch[]>('/api/admin/seed-batches')
    }
    catch {
      batches.value = []
    }
    finally {
      loadingBatches.value = false
    }
  }

  /**
   * Start arena mode. Loads images and generates a shuffled pair queue.
   */
  async function startArena(targetBatchId?: string) {
    loading.value = true
    arenaActive.value = true
    currentPairIndex.value = 0
    skippedCount.value = 0
    batchId.value = targetBatchId || null

    try {
      // Load images — either from a batch or all done images
      const images = await fetchGenerations(100, 0, undefined, {
        type: 'image',
        status: 'done',
        sort: 'recent',
        batchId: targetBatchId,
      })

      if (images.length < 2) {
        toast.add({
          title: 'Not enough images',
          description: 'Need at least 2 completed images for arena mode.',
          color: 'warning',
          icon: 'i-lucide-alert-circle',
        })
        arenaActive.value = false
        return
      }

      arenaImages.value = images

      // For batches, update the store
      for (const img of images) {
        store.upsert(img)
      }

      // Generate all pairs and filter out already-compared ones
      const allPairs = generateShuffledPairs(images)
      const uncompared = await filterUncomparedPairs(allPairs)

      if (uncompared.length === 0) {
        toast.add({
          title: 'All pairs compared',
          description: `All ${allPairs.length} possible pairs have already been compared.`,
          color: 'info',
          icon: 'i-lucide-check-circle',
        })
        arenaPairs.value = []
        return
      }

      arenaPairs.value = uncompared

      toast.add({
        title: 'Arena started',
        description: `${uncompared.length} pairs to compare (${allPairs.length - uncompared.length} already done).`,
        color: 'success',
        icon: 'i-lucide-swords',
      })
    }
    catch (err) {
      toast.add({
        title: 'Arena failed',
        description: err instanceof Error ? err.message : 'Could not start arena mode.',
        color: 'error',
        icon: 'i-lucide-alert-triangle',
      })
      arenaActive.value = false
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Submit a vote for the current pair and advance to the next.
   */
  async function submitArenaVote(winnerId: string) {
    const pair = currentPair.value
    if (!pair || voting.value) return

    voting.value = true
    try {
      const result: ImageComparisonVoteResponse = await submitImageComparison({
        leftId: pair.left.id,
        rightId: pair.right.id,
        winnerId,
        sourceContext: 'compare-page' as CompareSourceContext,
      })

      // Update local state with new scores
      if (result.leftGeneration) store.upsert(result.leftGeneration)
      if (result.rightGeneration) store.upsert(result.rightGeneration)

      // Advance to next pair
      currentPairIndex.value++

      if (currentPair.value === null) {
        toast.add({
          title: 'Arena complete! 🏆',
          description: `All ${arenaPairs.value.length} pairs have been compared.`,
          color: 'success',
          icon: 'i-lucide-trophy',
        })
      }
    }
    catch (err) {
      toast.add({
        title: 'Vote failed',
        description: err instanceof Error ? err.message : 'Could not save vote.',
        color: 'error',
        icon: 'i-lucide-alert-triangle',
      })
    }
    finally {
      voting.value = false
    }
  }

  /**
   * Skip the current pair without voting.
   */
  function skipPair() {
    if (!currentPair.value) return
    skippedCount.value++
    currentPairIndex.value++
  }

  /**
   * Exit arena mode and reset state.
   */
  function exitArena() {
    arenaActive.value = false
    arenaImages.value = []
    arenaPairs.value = []
    currentPairIndex.value = 0
    skippedCount.value = 0
    batchId.value = null
  }

  // ─── Batch Generation ─────────────────────────────────────
  const generating = ref(false)
  const generatingStatus = ref('')

  interface SeedBatchResponse {
    batchId: string
    label: string | null
    dimension: string
    generated: number
    failures: number
  }

  /**
   * Generate a new seed batch via the admin endpoint, then auto-start arena.
   */
  async function generateBatch(count = 10, label?: string, basePrompt?: string) {
    generating.value = true
    generatingStatus.value = `Generating ${count} person variations...`

    try {
      const result = await $fetch<SeedBatchResponse>('/api/admin/seed-batch', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: {
          count,
          label: label || `Person Tuning — ${new Date().toLocaleDateString()}`,
          ...(basePrompt && { basePrompt }),
        },
      })

      generatingStatus.value = `Done! ${result.generated} images generated.`

      toast.add({
        title: 'Batch generated! 🎉',
        description: `${result.generated} images created${result.failures ? ` (${result.failures} failed)` : ''}. Starting arena...`,
        color: 'success',
        icon: 'i-lucide-sparkles',
      })

      // Auto-start arena with the new batch
      await startArena(result.batchId)

      return result
    }
    catch (err) {
      generatingStatus.value = ''
      toast.add({
        title: 'Batch generation failed',
        description: err instanceof Error ? err.message : 'Could not generate batch.',
        color: 'error',
        icon: 'i-lucide-alert-triangle',
      })
      return null
    }
    finally {
      generating.value = false
      generatingStatus.value = ''
    }
  }

  return {
    arenaActive,
    arenaImages,
    currentPair,
    arenaStats,
    arenaComplete,
    progressPercent,
    loading,
    voting,
    batchId,
    batches,
    loadingBatches,
    loadBatches,
    startArena,
    submitArenaVote,
    skipPair,
    exitArena,
    generating,
    generatingStatus,
    generateBatch,
  }
}

