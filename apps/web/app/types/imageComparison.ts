import type { Generation } from '~/types/generation'

export const comparisonSourceContexts = [
  'gallery-card',
  'gallery-viewer',
  'gallery-detail',
  'recent-carousel',
  'compare-page',
] as const

export type CompareSourceContext = (typeof comparisonSourceContexts)[number]

export interface ImageComparison {
  id: string
  userId: string
  pairKey: string
  leftGenerationId: string
  rightGenerationId: string
  winnerGenerationId: string
  loserGenerationId: string
  sourceContext: CompareSourceContext
  createdAt: string
  updatedAt: string
}

export interface ImageComparisonVoteResponse {
  alreadyExists: boolean
  comparison: ImageComparison | null
  leftGeneration: Generation | null
  rightGeneration: Generation | null
}
