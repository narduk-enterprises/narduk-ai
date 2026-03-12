import type { Generation } from '~/types/generation'
import type {
  CompareSourceContext,
  ImageComparison,
  ImageComparisonVoteResponse,
} from '~/types/imageComparison'
import { comparisonSourceContexts } from '~/types/imageComparison'
import { createCompareRoute } from '~/utils/imageCompare'

function resolveCompareSourceContext(value: unknown): CompareSourceContext {
  if (
    typeof value === 'string' &&
    comparisonSourceContexts.includes(value as CompareSourceContext)
  ) {
    return value as CompareSourceContext
  }

  return 'compare-page'
}

function isComparableImage(generation: Generation | null): generation is Generation {
  return !!generation && generation.type === 'image' && generation.status === 'done'
}

export function useCompareLauncher() {
  async function launchCompare(generation: Generation, sourceContext: CompareSourceContext) {
    await navigateTo(createCompareRoute(generation.id, sourceContext))
  }

  return {
    launchCompare,
  }
}

export function useImageCompare() {
  const route = useRoute()
  const toast = useToast()
  const store = useGenerationsStore()
  const { fetchGeneration, fetchGenerations, fetchImageComparison, submitImageComparison } =
    useGenerate()

  const leftImage = ref<Generation | null>(null)
  const rightImage = ref<Generation | null>(null)
  const pairComparison = ref<ImageComparison | null>(null)
  const recentResult = ref<{
    comparison: ImageComparison
    winner: Generation
    loser: Generation
  } | null>(null)

  const loadingLeft = ref(false)
  const loadingRight = ref(false)
  const loadingPair = ref(false)
  const savingVote = ref(false)

  const pickerTarget = ref<'left' | 'right' | null>(null)
  const candidateSearch = ref('')
  const debouncedCandidateSearch = ref('')
  const candidateImages = ref<Generation[]>([])
  const loadingCandidates = ref(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const leftId = computed(() => (typeof route.query.left === 'string' ? route.query.left : ''))
  const rightId = computed(() => (typeof route.query.right === 'string' ? route.query.right : ''))
  const sourceContext = computed(() => resolveCompareSourceContext(route.query.source))
  const isPickerOpen = computed(() => pickerTarget.value !== null)

  watch(candidateSearch, (value) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedCandidateSearch.value = value
    }, 250)
  })

  async function updateRoute(left?: string, right?: string, nextSource?: CompareSourceContext) {
    await navigateTo(
      {
        path: '/compare',
        query: {
          left: left || undefined,
          right: right || undefined,
          source: nextSource || undefined,
        },
      },
      { replace: true },
    )
  }

  async function clearRightImage() {
    pairComparison.value = null
    await updateRoute(leftId.value || undefined, undefined, 'compare-page')
  }

  async function loadGeneration(id: string, target: 'left' | 'right', loadingState: Ref<boolean>) {
    if (!id) {
      if (target === 'left') leftImage.value = null
      else rightImage.value = null
      return
    }

    loadingState.value = true

    try {
      const generation = await fetchGeneration(id)
      if (!isComparableImage(generation)) {
        throw new Error('Only completed images can be compared.')
      }

      store.upsert(generation)

      if (target === 'left') leftImage.value = generation
      else rightImage.value = generation
    } catch (error) {
      toast.add({
        title: 'Image unavailable',
        description: error instanceof Error ? error.message : 'This image cannot be compared.',
        color: 'warning',
        icon: 'i-lucide-alert-circle',
      })

      if (target === 'left') {
        leftImage.value = null
        await updateRoute(undefined, undefined, sourceContext.value)
      } else {
        rightImage.value = null
        await updateRoute(leftId.value || undefined, undefined, sourceContext.value)
      }
    } finally {
      loadingState.value = false
    }
  }

  watch(
    leftId,
    async (id) => {
      await loadGeneration(id, 'left', loadingLeft)
    },
    { immediate: true },
  )

  watch(
    rightId,
    async (id) => {
      await loadGeneration(id, 'right', loadingRight)
    },
    { immediate: true },
  )

  watch(
    [leftId, rightId],
    async ([nextLeftId, nextRightId]) => {
      if (!nextLeftId || !nextRightId || nextLeftId === nextRightId) {
        pairComparison.value = null
        return
      }

      loadingPair.value = true
      try {
        pairComparison.value = await fetchImageComparison(nextLeftId, nextRightId)
      } catch {
        pairComparison.value = null
      } finally {
        loadingPair.value = false
      }
    },
    { immediate: true },
  )

  async function loadCandidateImages() {
    if (!pickerTarget.value) return

    loadingCandidates.value = true
    try {
      const rows = await fetchGenerations(100, 0, debouncedCandidateSearch.value, {
        type: 'image',
        status: 'done',
        sort: 'recent',
      })

      const excluded = new Set<string>()
      if (pickerTarget.value === 'left' && rightId.value) excluded.add(rightId.value)
      if (pickerTarget.value === 'right' && leftId.value) excluded.add(leftId.value)

      candidateImages.value = rows.filter((row) => !excluded.has(row.id))
    } finally {
      loadingCandidates.value = false
    }
  }

  watch(
    [pickerTarget, debouncedCandidateSearch],
    async ([target]) => {
      if (!target) {
        candidateImages.value = []
        return
      }

      await loadCandidateImages()
    },
    { immediate: false },
  )

  async function openPicker(target: 'left' | 'right') {
    recentResult.value = null
    pickerTarget.value = target
    candidateSearch.value = ''
    debouncedCandidateSearch.value = ''
    await loadCandidateImages()
  }

  function closePicker() {
    pickerTarget.value = null
  }

  async function selectCandidate(generation: Generation) {
    recentResult.value = null
    if (pickerTarget.value === 'left') {
      await updateRoute(
        generation.id,
        generation.id === rightId.value ? undefined : rightId.value || undefined,
        'compare-page',
      )
    } else if (pickerTarget.value === 'right') {
      await updateRoute(leftId.value || undefined, generation.id, sourceContext.value)
    }

    closePicker()
  }

  async function submitVote(winnerId: string) {
    if (!leftImage.value || !rightImage.value || savingVote.value) return

    savingVote.value = true
    try {
      const result: ImageComparisonVoteResponse = await submitImageComparison({
        leftId: leftImage.value.id,
        rightId: rightImage.value.id,
        winnerId,
        sourceContext: sourceContext.value,
      })

      if (result.leftGeneration) {
        leftImage.value = result.leftGeneration
        store.upsert(result.leftGeneration)
      }
      if (result.rightGeneration) {
        rightImage.value = result.rightGeneration
        store.upsert(result.rightGeneration)
      }

      pairComparison.value = result.comparison

      if (result.alreadyExists) {
        toast.add({
          title: 'Comparison already saved',
          description: 'This image pair already has a locked winner.',
          color: 'info',
          icon: 'i-lucide-history',
        })
        return
      }

      if (!result.comparison || !result.leftGeneration || !result.rightGeneration) {
        throw new Error('Comparison response was incomplete.')
      }

      const winner =
        result.leftGeneration.id === winnerId ? result.leftGeneration : result.rightGeneration
      const loser =
        result.leftGeneration.id === winnerId ? result.rightGeneration : result.leftGeneration

      recentResult.value = {
        comparison: result.comparison,
        winner,
        loser,
      }

      toast.add({
        title: 'Winner saved',
        description: 'The comparison was stored and the ranking scores were updated.',
        color: 'success',
        icon: 'i-lucide-trophy',
      })

      await clearRightImage()
    } catch (error) {
      toast.add({
        title: 'Comparison failed',
        description: error instanceof Error ? error.message : 'Could not save the comparison.',
        color: 'error',
        icon: 'i-lucide-alert-triangle',
      })
    } finally {
      savingVote.value = false
    }
  }

  function clearRecentResult() {
    recentResult.value = null
  }

  onUnmounted(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
  })

  const canVote = computed(
    () =>
      !!leftImage.value &&
      !!rightImage.value &&
      !pairComparison.value &&
      !loadingLeft.value &&
      !loadingRight.value &&
      !loadingPair.value,
  )

  return {
    leftId,
    rightId,
    sourceContext,
    leftImage,
    rightImage,
    pairComparison,
    recentResult,
    loadingLeft,
    loadingRight,
    loadingPair,
    savingVote,
    canVote,
    pickerTarget,
    isPickerOpen,
    candidateSearch,
    candidateImages,
    loadingCandidates,
    openPicker,
    closePicker,
    selectCandidate,
    clearRightImage,
    submitVote,
    clearRecentResult,
  }
}
