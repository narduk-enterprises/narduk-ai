/**
 * Generation type definition for frontend use.
 */
export type GenerationStatus = 'pending' | 'done' | 'failed' | 'expired'
export type GenerationSort = 'recent' | 'rank'

export interface GenerationQueryFilters {
  type?: 'image' | 'video'
  mode?: string
  status?: GenerationStatus
  sort?: GenerationSort
}

export interface Generation {
  id: string
  userId: string
  type: 'image' | 'video'
  mode: 't2i' | 't2v' | 'i2v' | 'i2i'
  prompt: string
  sourceGenerationId: string | null
  status: 'pending' | 'done' | 'failed' | 'expired'
  xaiRequestId: string | null
  r2Key: string | null
  mediaUrl: string | null
  thumbnailUrl: string | null
  comparisonScore: number
  comparisonWins: number
  comparisonLosses: number
  lastComparedAt: string | null
  duration: number | null
  generationTimeMs: number | null
  aspectRatio: string | null
  resolution: string | null
  metadata: string | null
  presets: string | null
  createdAt: string
  updatedAt: string
}
