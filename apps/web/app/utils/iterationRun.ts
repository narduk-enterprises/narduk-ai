import type { IterationRun, IterationStep } from '~/types/chat'

export interface IterationStepResult {
  revisedPrompt: string
  changeSummary: string
  message?: string | null
}

interface RunIterationLoopOptions {
  initialPrompt: string
  goal: string
  round?: number
  totalIterations?: number
  signal?: AbortSignal
  runStep: (input: {
    prompt: string
    goal: string
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
  round?: number
  totalIterations?: number
}): IterationRun {
  return {
    goal: input.goal.trim(),
    initialPrompt: input.initialPrompt.trim(),
    currentPrompt: input.initialPrompt.trim(),
    status: 'running',
    completedIterations: 0,
    totalIterations: input.totalIterations ?? 5,
    round: input.round ?? 1,
    steps: [],
  }
}

export function buildIterationUserMessage(prompt: string, goal: string, round = 1): string {
  const heading = round > 1 ? `Continue Iteration Round ${round}` : 'Iteration Request'

  return `${heading}\nGoal: ${goal.trim()}\n\nStarting Prompt:\n${prompt.trim()}`
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

    try {
      const result = await options.runStep({
        prompt: run.currentPrompt,
        goal: run.goal,
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
