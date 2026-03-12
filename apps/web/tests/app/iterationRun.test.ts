import { describe, expect, it } from 'vitest'

import { deserializePersistedChatMessage } from '../../app/utils/chatPersistence'
import { runIterationLoop } from '../../app/utils/iterationRun'

describe('iteration run helpers', () => {
  it('completes five passes and accumulates the latest prompt', async () => {
    const run = await runIterationLoop({
      initialPrompt: 'portrait prompt',
      goal: 'Make it more cinematic',
      context: 'Keep the same face shape and plain white background.',
      async runStep({ prompt, iteration }) {
        return {
          revisedPrompt: `${prompt} :: step-${iteration}`,
          changeSummary: `Applied pass ${iteration}.`,
          message: `Pass ${iteration} done.`,
          contextSnapshot: 'Keep the same face shape and plain white background.',
          renderedPrompt: `rendered-${iteration}`,
          imageUrl: `/api/media/iteration-${iteration}.png`,
          imageAnalysis: `Review for pass ${iteration}.`,
        }
      },
    })

    expect(run.status).toBe('completed')
    expect(run.completedIterations).toBe(5)
    expect(run.steps).toHaveLength(5)
    expect(run.currentPrompt).toContain('step-5')
    expect(run.steps[0]).toMatchObject({
      contextSnapshot: 'Keep the same face shape and plain white background.',
      renderedPrompt: 'rendered-1',
      imageUrl: '/api/media/iteration-1.png',
      imageAnalysis: 'Review for pass 1.',
    })
  })

  it('stops cleanly when the active pass aborts', async () => {
    const controller = new AbortController()

    const run = await runIterationLoop({
      initialPrompt: 'portrait prompt',
      goal: 'Make it more cinematic',
      context: 'Keep the background plain.',
      signal: controller.signal,
      async runStep({ prompt, iteration }) {
        if (iteration === 3) {
          controller.abort()
          const error = new Error('Aborted')
          error.name = 'AbortError'
          throw error
        }

        return {
          revisedPrompt: `${prompt} :: step-${iteration}`,
          changeSummary: `Applied pass ${iteration}.`,
        }
      },
    })

    expect(run.status).toBe('stopped')
    expect(run.completedIterations).toBe(2)
    expect(run.steps).toHaveLength(2)
    expect(run.currentPrompt).toContain('step-2')
  })

  it('starts a follow-up round from the latest prompt', async () => {
    const firstRun = await runIterationLoop({
      initialPrompt: 'portrait prompt',
      goal: 'Make it more cinematic',
      context: 'Preserve facial likeness.',
      round: 1,
      async runStep({ prompt, iteration }) {
        return {
          revisedPrompt: `${prompt} :: round-1-step-${iteration}`,
          changeSummary: `Round 1 pass ${iteration}.`,
        }
      },
    })

    const secondRun = await runIterationLoop({
      initialPrompt: firstRun.currentPrompt,
      goal: firstRun.goal,
      context: firstRun.context,
      round: firstRun.round + 1,
      async runStep({ prompt, iteration }) {
        return {
          revisedPrompt: `${prompt} :: round-2-step-${iteration}`,
          changeSummary: `Round 2 pass ${iteration}.`,
        }
      },
    })

    expect(secondRun.round).toBe(2)
    expect(secondRun.initialPrompt).toBe(firstRun.currentPrompt)
    expect(secondRun.currentPrompt).toContain('round-2-step-5')
  })

  it('rehydrates iteration runs from persisted chat messages', () => {
    const message = deserializePersistedChatMessage({
      role: 'assistant',
      content: '<message>Iteration round 1 completed.</message>',
      parsedResponse: JSON.stringify({
        message: 'Iteration round 1 completed.',
        prompt: 'final prompt',
        iterationRun: {
          goal: 'Make it more cinematic',
          context: 'Keep the white background and focus on likeness.',
          initialPrompt: 'portrait prompt',
          currentPrompt: 'final prompt',
          status: 'completed',
          completedIterations: 5,
          totalIterations: 5,
          round: 1,
          steps: [
            {
              iteration: 1,
              prompt: 'portrait prompt :: step-1',
              changeSummary: 'Added dramatic lighting.',
              contextSnapshot: 'Keep the white background and focus on likeness.',
              renderedPrompt: 'portrait prompt :: render-1',
              imageUrl: '/api/media/render-1.png',
              imageAnalysis: 'The pose is close, but the anatomy still needs refinement.',
            },
          ],
        },
      }),
    })

    expect(message.parsedResponse?.iterationRun?.goal).toBe('Make it more cinematic')
    expect(message.parsedResponse?.iterationRun?.context).toBe(
      'Keep the white background and focus on likeness.',
    )
    expect(message.parsedResponse?.iterationRun?.steps[0]?.changeSummary).toBe(
      'Added dramatic lighting.',
    )
    expect(message.parsedResponse?.iterationRun?.steps[0]?.imageUrl).toBe('/api/media/render-1.png')
  })
})
