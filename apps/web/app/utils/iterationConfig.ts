import type { IterationStep } from '~/types/chat'

export const DEFAULT_ITERATION_PASS_COUNT = 5
export const MIN_ITERATION_PASS_COUNT = 1
export const MAX_ITERATION_PASS_COUNT = 1000
export const MAX_ITERATION_CONTEXT_STEPS = 12

export function clampIterationPassCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ITERATION_PASS_COUNT
  }

  const normalized = Math.trunc(value)
  return Math.min(MAX_ITERATION_PASS_COUNT, Math.max(MIN_ITERATION_PASS_COUNT, normalized))
}

export function parseIterationPassCount(value: unknown): number {
  if (typeof value === 'number') {
    return clampIterationPassCount(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return DEFAULT_ITERATION_PASS_COUNT
    }

    return clampIterationPassCount(Number(trimmed))
  }

  return DEFAULT_ITERATION_PASS_COUNT
}

export function trimIterationContextSteps<T extends Pick<IterationStep, 'iteration'>>(
  steps: T[],
  maxSteps = MAX_ITERATION_CONTEXT_STEPS,
): T[] {
  if (steps.length <= maxSteps) {
    return [...steps]
  }

  return steps.slice(-maxSteps)
}
