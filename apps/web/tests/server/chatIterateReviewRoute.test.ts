import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentBody: Record<string, unknown> = {}

const logger = {
  child: vi.fn(() => logger),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockGrokChat = vi.fn()
const mockGrokListModels = vi.fn()
const mockGetSystemPrompt = vi.fn()

vi.mock('#server/utils/grok', () => ({
  grokChat: mockGrokChat,
  grokListModels: mockGrokListModels,
}))

vi.mock('#server/utils/systemPrompts', () => ({
  getSystemPrompt: mockGetSystemPrompt,
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', (opts: { statusCode: number; message: string }) => {
  const error = new Error(opts.message) as Error & { statusCode: number }
  error.statusCode = opts.statusCode
  return error
})
vi.stubGlobal(
  'requireAuth',
  vi.fn(async () => ({ id: 'user-1' })),
)
vi.stubGlobal(
  'enforceRateLimit',
  vi.fn(async () => {}),
)
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, parser: (value: unknown) => unknown) => parser(currentBody)),
)
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ xaiApiKey: 'test-key' })),
)
vi.stubGlobal(
  'useLogger',
  vi.fn(() => logger),
)

describe('POST /api/chat/iterate-review', () => {
  beforeEach(() => {
    currentBody = {}
    mockGrokChat.mockReset()
    mockGrokListModels.mockReset()
    mockGetSystemPrompt.mockReset()
    logger.child.mockClear()
    logger.info.mockClear()
    logger.warn.mockClear()
    logger.error.mockClear()
    mockGetSystemPrompt.mockResolvedValue('review-system-prompt')
    mockGrokListModels.mockResolvedValue([{ id: 'grok-4' }, { id: 'grok-3-mini' }])
  })

  it('validates the request body', async () => {
    currentBody = {
      renderedPrompt: 'test prompt',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
    }

    const handler = (await import('../../server/api/chat/iterate-review.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      name: 'ZodError',
    })
  })

  it('uses a vision-capable model and returns the normalized review payload', async () => {
    currentBody = {
      renderedPrompt: 'A cinematic portrait in soft window light',
      goal: 'Match the preset person more accurately',
      imageUrl: 'data:image/png;base64,abc123',
      iteration: 2,
      totalIterations: 5,
      priorSteps: [
        {
          iteration: 1,
          prompt: 'A cinematic portrait with softer lighting',
          renderedPrompt: 'A cinematic portrait in flat studio light',
          changeSummary: 'Moved the lighting toward a softer window-lit look.',
          imageAnalysis: 'The lighting improved, but the facial structure still drifted.',
        },
      ],
    }
    mockGrokChat.mockResolvedValue(
      JSON.stringify({
        revisedPrompt:
          'A cinematic portrait of the preset woman with a narrower jawline and smaller natural breasts in soft window light.',
        changeSummary: 'Tightened the anatomy cues to better match the preset person.',
        imageAnalysis: 'The lighting is close, but the anatomy still reads too generalized.',
        message: 'Focused the next pass on likeness accuracy.',
      }),
    )

    const handler = (await import('../../server/api/chat/iterate-review.post')).default
    const result = await handler({} as never)

    expect(result).toEqual({
      revisedPrompt:
        'A cinematic portrait of the preset woman with a narrower jawline and smaller natural breasts in soft window light.',
      changeSummary: 'Tightened the anatomy cues to better match the preset person.',
      imageAnalysis: 'The lighting is close, but the anatomy still reads too generalized.',
      message: 'Focused the next pass on likeness accuracy.',
    })
    expect(mockGetSystemPrompt).toHaveBeenCalledWith(expect.anything(), 'chat_iteration_review')
    expect(mockGrokChat).toHaveBeenCalledWith(
      'test-key',
      [
        { role: 'system', content: 'review-system-prompt' },
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('Goal:\nMatch the preset person more accurately'),
            }),
            expect.objectContaining({
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc123' },
            }),
          ]),
        }),
      ],
      'grok-4',
      { type: 'json_object' },
    )
  })

  it('rejects malformed model output', async () => {
    currentBody = {
      renderedPrompt: 'A cinematic portrait in soft window light',
      goal: 'Match the preset person more accurately',
      imageUrl: 'data:image/png;base64,abc123',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
    }
    mockGrokChat.mockResolvedValue('not-json')

    const handler = (await import('../../server/api/chat/iterate-review.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
