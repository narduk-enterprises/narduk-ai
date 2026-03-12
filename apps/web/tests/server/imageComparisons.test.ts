import { describe, expect, it } from 'vitest'
import {
  calculateComparisonScoreUpdate,
  DEFAULT_COMPARISON_SCORE,
  normalizeComparisonPairKey,
} from '../../server/utils/imageComparisons'

describe('image comparison ranking utilities', () => {
  it('normalizes pair keys regardless of input order', () => {
    expect(normalizeComparisonPairKey('image-b', 'image-a')).toBe(
      normalizeComparisonPairKey('image-a', 'image-b'),
    )
  })

  it('moves winner and loser scores away from the default baseline', () => {
    const result = calculateComparisonScoreUpdate(
      DEFAULT_COMPARISON_SCORE,
      DEFAULT_COMPARISON_SCORE,
    )

    expect(result.winnerScore).toBe(1016)
    expect(result.loserScore).toBe(984)
  })
})
