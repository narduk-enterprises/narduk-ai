import type { Generation } from '~/types/generation'
import type { CompareSourceContext } from '~/types/imageComparison'
import { getGenerationSharePrompt } from '~/utils/generationPrompt'

/**
 * useGalleryActions — centralized UI actions for generation items (delete, upscale, remix, navigate).
 */
export function useGalleryActions(options?: {
  store?: ReturnType<typeof useGenerationsStore>
  galleryViewer?: ReturnType<typeof useGalleryViewer>
}) {
  const store = options?.store ?? useGenerationsStore()
  const galleryViewer = options?.galleryViewer ?? useGalleryViewer()
  const {
    deleteGeneration,
    upscaleGeneration,
    remixGeneration,
    error: generateError,
  } = useGenerate()
  const { launchCompare } = useCompareLauncher()
  const toast = useToast()

  const remixingId = ref<string | null>(null)
  const upscalingId = ref<string | null>(null)

  async function handleDelete(gen: Generation) {
    try {
      await deleteGeneration(gen.id)
      store.remove(gen.id)
    } catch {
      /* silent */
    }
  }

  function handleUseAsSource(gen: Generation) {
    galleryViewer.close()
    navigateTo({ path: '/generate', query: { source: gen.id, mode: 'i2v' } })
  }

  function handleEditImage(gen: Generation) {
    galleryViewer.close()
    navigateTo({ path: '/generate', query: { source: gen.id, mode: 'i2i' } })
  }

  function handleUsePrompt(gen: Generation) {
    galleryViewer.close()
    navigateTo({
      path: '/generate',
      query: {
        prompt: getGenerationSharePrompt(gen),
        mode: gen.type === 'video' ? 't2v' : 't2i',
      },
    })
  }

  function handleRetry(gen: Generation) {
    galleryViewer.close()
    navigateTo({ path: '/generate', query: { prompt: gen.prompt, mode: gen.mode } })
  }

  function openViewer(gen: Generation, list: Generation[], loadMoreCallback?: () => Promise<void>) {
    const idx = list.findIndex((g) => g.id === gen.id)
    galleryViewer.open(list, idx >= 0 ? idx : 0, loadMoreCallback)
  }

  async function handleUpscale(gen: Generation) {
    if (upscalingId.value) return
    upscalingId.value = gen.id
    try {
      const result = await upscaleGeneration(gen.id)
      if (result) {
        store.upsert(result)
        toast.add({
          title: 'Upscaling Started',
          description:
            'Your image is being upscaled to 2K resolution. It will appear at the top of your gallery shortly.',
          color: 'success',
          icon: 'i-lucide-sparkles',
        })
      } else if (generateError.value) {
        toast.add({
          title: 'Upscale Failed',
          description: generateError.value,
          color: 'error',
          icon: 'i-lucide-alert-circle',
        })
      }
    } finally {
      upscalingId.value = null
    }
  }

  async function handleRemix(gen: Generation) {
    if (remixingId.value) return
    remixingId.value = gen.id
    toast.add({
      title: 'Remixing…',
      description: 'Creating a fresh variation of your prompt.',
      color: 'info',
      icon: 'i-lucide-shuffle',
    })
    try {
      const result = await remixGeneration(gen)
      if (result) {
        store.upsert(result)
        toast.add({
          title: 'Remix Created',
          description:
            result.type === 'video'
              ? 'Your remixed video is generating!'
              : 'A remixed image has been created!',
          color: 'success',
          icon: 'i-lucide-shuffle',
        })
      } else if (generateError.value) {
        toast.add({
          title: 'Remix Failed',
          description: generateError.value,
          color: 'error',
          icon: 'i-lucide-alert-circle',
        })
      }
    } finally {
      remixingId.value = null
    }
  }

  async function handleCompare(gen: Generation, sourceContext: CompareSourceContext) {
    galleryViewer.close()
    await launchCompare(gen, sourceContext)
  }

  return {
    remixingId,
    upscalingId,
    handleDelete,
    handleUseAsSource,
    handleEditImage,
    handleUsePrompt,
    handleRetry,
    openViewer,
    handleUpscale,
    handleRemix,
    handleCompare,
  }
}
