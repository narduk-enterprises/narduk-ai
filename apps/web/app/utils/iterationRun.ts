import type { IterationRun, IterationStep } from '~/types/chat'
import { clampIterationPassCount, DEFAULT_ITERATION_PASS_COUNT } from '~/utils/iterationConfig'

export interface IterationStepResult {
  revisedPrompt: string
  changeSummary: string
  message?: string | null
  contextSnapshot?: string | null
  renderedPrompt?: string | null
  generationId?: string | null
  imageUrl?: string | null
  imageAnalysis?: string | null
}

interface RunIterationLoopOptions {
  initialPrompt: string
  goal: string
  context?: string
  round?: number
  totalIterations?: number
  signal?: AbortSignal
  getContext?: () => string
  runStep: (input: {
    prompt: string
    goal: string
    context: string
    iteration: number
    totalIterations: number
    round: number
    priorSteps: IterationStep[]
    signal?: AbortSignal
  }) => Promise<IterationStepResult>
  onUpdate?: (run: IterationRun) => void
}

export function createIterationRun(input: {
  initialPrompt: string
  goal: string
  context?: string
  round?: number
  totalIterations?: number
}): IterationRun {
  return {
    goal: input.goal.trim(),
    context: input.context?.trim() || '',
    initialPrompt: input.initialPrompt.trim(),
    currentPrompt: input.initialPrompt.trim(),
    status: 'running',
    completedIterations: 0,
    totalIterations: clampIterationPassCount(input.totalIterations ?? DEFAULT_ITERATION_PASS_COUNT),
    round: input.round ?? 1,
    steps: [],
  }
}

export function buildIterationUserMessage(
  prompt: string,
  goal: string,
  round = 1,
  context = '',
  totalIterations = DEFAULT_ITERATION_PASS_COUNT,
): string {
  const heading = round > 1 ? `Continue Iteration Round ${round}` : 'Iteration Request'

  const normalizedContext = context.trim()

  return [
    `${heading}`,
    `Goal: ${goal.trim()}`,
    `Requested passes: ${clampIterationPassCount(totalIterations)}`,
    normalizedContext ? `Context:\n${normalizedContext}` : null,
    `Starting Prompt:\n${prompt.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function deriveIterationSessionTitle(goal: string): string {
  const normalized = goal.replaceAll(/\s+/g, ' ').trim()
  if (!normalized) return 'Prompt iteration'

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized
}

export function createAbortError(): Error {
  const error = new Error('Iteration aborted')
  error.name = 'AbortError'
  return error
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
  )
}

export async function runIterationLoop(options: RunIterationLoopOptions): Promise<IterationRun> {
  const run = createIterationRun({
    initialPrompt: options.initialPrompt,
    goal: options.goal,
    context: options.context,
    round: options.round,
    totalIterations: options.totalIterations,
  })

  options.onUpdate?.({ ...run, steps: [...run.steps] })

  for (let iteration = 1; iteration <= run.totalIterations; iteration++) {
    if (options.signal?.aborted) {
      run.status = 'stopped'
      options.onUpdate?.({ ...run, steps: [...run.steps] })
      return run
    }

    run.context = options.getContext?.().trim() || run.context

    try {
      const result = await options.runStep({
        prompt: run.currentPrompt,
        goal: run.goal,
        context: run.context,
        iteration,
        totalIterations: run.totalIterations,
        round: run.round,
        priorSteps: [...run.steps],
        signal: options.signal,
      })

      const step: IterationStep = {
        iteration,
        prompt: result.revisedPrompt.trim(),
        changeSummary: result.changeSummary.trim(),
        message: result.message?.trim() || null,
        contextSnapshot: result.contextSnapshot?.trim() || null,
        renderedPrompt: result.renderedPrompt?.trim() || null,
        generationId: result.generationId?.trim() || null,
        imageUrl: result.imageUrl?.trim() || null,
        imageAnalysis: result.imageAnalysis?.trim() || null,
      }

      run.steps = [...run.steps, step]
      run.currentPrompt = step.prompt
      run.completedIterations = run.steps.length

      options.onUpdate?.({ ...run, steps: [...run.steps] })
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) {
        run.status = 'stopped'
        options.onUpdate?.({ ...run, steps: [...run.steps] })
        return run
      }

      run.status = 'failed'
      options.onUpdate?.({ ...run, steps: [...run.steps] })
      throw error
    }
  }

  run.status = 'completed'
  options.onUpdate?.({ ...run, steps: [...run.steps] })
  return run
}
