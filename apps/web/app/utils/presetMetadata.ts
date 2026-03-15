import type { Generation } from '~/types/generation'

/**
 * Create a synthetic Generation object suitable for the GalleryViewer.
 * Used in ChatMessages, presets/[id], and anywhere a viewer-compatible
 * object is needed from a plain image URL.
 */
export function createSyntheticGeneration(
  url: string,
  prompt = '',
  generationId?: string | null,
): Generation {
  return {
    id: generationId || url,
    userId: '',
    type: 'image',
    mode: 't2i',
    prompt,
    sourceGenerationId: null,
    status: 'done',
    xaiRequestId: null,
    r2Key: null,
    mediaUrl: url,
    thumbnailUrl: url,
    comparisonScore: 0,
    comparisonWins: 0,
    comparisonLosses: 0,
    lastComparedAt: null,
    duration: null,
    generationTimeMs: null,
    aspectRatio: null,
    resolution: null,
    metadata: null,
    presets: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

interface PresetMeta {
  headshotUrl?: string
  fullBodyUrl?: string
  previewImageUrl?: string
}

/**
 * Safely parse preset metadata JSON. Returns null on invalid/missing input.
 */
export function parsePresetMetadata(metadata: string | null | undefined): PresetMeta | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as PresetMeta
  } catch {
    return null
  }
}

/**
 * Extract the best available thumbnail URL from preset metadata.
 */
export function getPresetThumbnail(metadata: string | null | undefined): string | null {
  const meta = parsePresetMetadata(metadata)
  if (!meta) return null
  return meta.headshotUrl || meta.previewImageUrl || meta.fullBodyUrl || null
}
