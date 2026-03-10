/**
 * Generation type definition for frontend use.
 */
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
  duration: number | null
  aspectRatio: string | null
  resolution: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
}
