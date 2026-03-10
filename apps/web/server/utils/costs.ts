/**
 * Estimated cost calculation for xAI Grok API calls.
 *
 * Pricing based on xAI's published rates:
 *   - grok-imagine-image:  $0.02 per image
 *   - grok-imagine-video:  $0.05 per second of video
 *   - grok-3-mini (chat):  ~$0.30/1M input tokens, $0.50/1M output tokens
 */

/** Per-image cost in USD */
const IMAGE_COST_USD = 0.02

/** Per-second video cost in USD */
const VIDEO_COST_PER_SECOND_USD = 0.05

/** Default video duration when not specified */
const DEFAULT_VIDEO_DURATION_S = 6

/**
 * Estimate the cost of a generation based on type and parameters.
 */
export function estimateGenerationCost(params: {
  type: 'image' | 'video'
  duration?: number | null
}): number {
  if (params.type === 'image') {
    return IMAGE_COST_USD
  }
  const seconds = params.duration ?? DEFAULT_VIDEO_DURATION_S
  return seconds * VIDEO_COST_PER_SECOND_USD
}
