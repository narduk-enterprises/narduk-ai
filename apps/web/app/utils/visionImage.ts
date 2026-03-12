interface VisionTextPart {
  type: 'text'
  text: string
}

interface VisionImagePart {
  type: 'image_url'
  image_url: { url: string }
}

interface VisionMessageLike {
  content: string | Array<VisionTextPart | VisionImagePart>
}

interface VisionFileReader {
  error?: FileReader['error']
  onerror: FileReader['onerror']
  onload: FileReader['onload']
  readAsDataURL: FileReader['readAsDataURL']
  result: FileReader['result']
}

type VisionFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{ blob: () => Promise<Blob>; ok: boolean }>

type VisionFileReaderFactory = () => VisionFileReader

export function messageContainsImage(message: VisionMessageLike): boolean {
  return Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url')
}

export function payloadNeedsVision(messages: VisionMessageLike[]): boolean {
  return messages.some(messageContainsImage)
}

export function shouldInlineVisionImage(imageUrl: string, currentOrigin: string): boolean {
  if (imageUrl.startsWith('data:')) return false
  if (imageUrl.startsWith('blob:')) return true
  if (imageUrl.startsWith('/')) return true

  try {
    return new URL(imageUrl).origin === currentOrigin
  } catch {
    return false
  }
}

export async function blobToDataUrl(
  blob: Blob,
  createReader: VisionFileReaderFactory = () => new FileReader(),
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = createReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to encode image for the vision model.'))
    }

    reader.onerror = () => {
      reject(reader.error instanceof Error ? reader.error : new Error('Failed to read image data.'))
    }

    reader.readAsDataURL(blob)
  })
}

export async function resolveVisionImageUrl(
  imageUrl: string,
  currentOrigin: string,
  fetchImpl: VisionFetch = fetch,
  createReader: VisionFileReaderFactory = () => new FileReader(),
): Promise<string> {
  if (!shouldInlineVisionImage(imageUrl, currentOrigin)) {
    return imageUrl
  }

  const response = await fetchImpl(imageUrl, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Failed to load image before sending it to the agent.')
  }

  return await blobToDataUrl(await response.blob(), createReader)
}
