import type { CompareSourceContext } from '~/types/imageComparison'

export const DEFAULT_COMPARISON_SCORE = 1000

export function createCompareRoute(
  leftId: string,
  sourceContext: CompareSourceContext,
  rightId?: string,
) {
  return {
    path: '/compare',
    query: {
      left: leftId,
      right: rightId || undefined,
      source: sourceContext,
    },
  }
}

export function formatComparisonScore(score?: number | null) {
  return score ?? DEFAULT_COMPARISON_SCORE
}
