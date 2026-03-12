export interface XaiModelCatalog {
  imageModels: string[]
  videoModels: string[]
  chatModels: string[]
  visionModels: string[]
  preferredImageModel: string | null
  preferredVideoModel: string | null
  preferredChatModel: string | null
  preferredVisionModel: string | null
}

const PREFERRED_IMAGE_MODELS = ['grok-imagine-image']
const PREFERRED_VIDEO_MODELS = ['grok-imagine-video']
const PREFERRED_CHAT_MODELS = ['grok-3-mini', 'grok-4', 'grok-4.20-beta-latest-non-reasoning']
const PREFERRED_VISION_MODELS = [
  'grok-4.20-beta-latest-non-reasoning',
  'grok-4',
  'grok-4.20-beta-latest',
]

export function pickPreferredModel(
  availableModels: string[],
  preferredModels: string[],
): string | null {
  for (const model of preferredModels) {
    if (availableModels.includes(model)) {
      return model
    }
  }

  return availableModels[0] ?? null
}

export function isVisionCapableChatModel(modelId: string): boolean {
  const normalizedId = modelId.toLowerCase()
  return normalizedId.includes('vision') || normalizedId.startsWith('grok-4')
}

export function buildXaiModelCatalog(modelIds: string[]): XaiModelCatalog {
  const sortedModelIds = [...modelIds].sort()
  const imageModels = sortedModelIds.filter(
    (id) => id.includes('image') || id.includes('imagine-image'),
  )
  const videoModels = sortedModelIds.filter(
    (id) => id.includes('video') || id.includes('imagine-video'),
  )
  const chatModels = sortedModelIds.filter(
    (id) => !imageModels.includes(id) && !videoModels.includes(id) && !id.includes('imagine'),
  )
  const visionModels = chatModels.filter(isVisionCapableChatModel)

  return {
    imageModels,
    videoModels,
    chatModels,
    visionModels,
    preferredImageModel: pickPreferredModel(imageModels, PREFERRED_IMAGE_MODELS),
    preferredVideoModel: pickPreferredModel(videoModels, PREFERRED_VIDEO_MODELS),
    preferredChatModel: pickPreferredModel(chatModels, PREFERRED_CHAT_MODELS),
    preferredVisionModel: pickPreferredModel(visionModels, PREFERRED_VISION_MODELS),
  }
}
