export const DEFAULT_COMPARISON_SCORE = 1000
export const COMPARISON_ELO_K_FACTOR = 32

export const comparisonSourceContexts = [
  'gallery-card',
  'gallery-viewer',
  'gallery-detail',
  'recent-carousel',
  'compare-page',
] as const

export type ComparisonSourceContext = (typeof comparisonSourceContexts)[number]

export function createGenerationComparisonDefaults() {
  return {
    comparisonScore: DEFAULT_COMPARISON_SCORE,
    comparisonWins: 0,
    comparisonLosses: 0,
    lastComparedAt: null,
  }
}

export function normalizeComparisonPairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort((a, b) => a.localeCompare(b)).join('::')
}

function expectedScore(score: number, opponentScore: number) {
  return 1 / (1 + 10 ** ((opponentScore - score) / 400))
}

export function calculateComparisonScoreUpdate(winnerScore: number, loserScore: number) {
  const winnerExpected = expectedScore(winnerScore, loserScore)
  const loserExpected = expectedScore(loserScore, winnerScore)

  return {
    winnerScore: Math.round(winnerScore + COMPARISON_ELO_K_FACTOR * (1 - winnerExpected)),
    loserScore: Math.round(loserScore + COMPARISON_ELO_K_FACTOR * (0 - loserExpected)),
  }
}
