import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentBody: Record<string, unknown> = {}
let dbPromptEnhanceModel: string | null = 'db-chat-model'
let dbImageModel: string | null = 'db-image-model'

const logger = {
  child: vi.fn(() => logger),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockGrokChat = vi.fn()
const mockGrokGenerateImage = vi.fn()
const mockGrokListModels = vi.fn()
const mockGetSystemPrompt = vi.fn()
const mockPersistGeneratedImage = vi.fn()

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
}))

vi.mock('#server/database/schema', () => ({
  appSettings: {
    id: 'id',
    promptEnhanceModel: 'prompt_enhance_model',
    imageModel: 'image_model',
  },
}))

vi.mock('#server/utils/database', () => ({
  useAppDatabase: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => ({
            promptEnhanceModel: dbPromptEnhanceModel,
            imageModel: dbImageModel,
          })),
        })),
      })),
    })),
  })),
}))

vi.mock('#server/utils/grok', () => ({
  xaiImagineChat: mockGrokChat,
  grokGenerateImage: mockGrokGenerateImage,
  xaiImagineListModels: mockGrokListModels,
}))

vi.mock('#server/utils/systemPrompts', () => ({
  getAppSystemPrompt: mockGetSystemPrompt,
}))

vi.mock('#server/utils/persistGeneratedImage', () => ({
  persistGeneratedImage: mockPersistGeneratedImage,
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

describe('POST /api/chat/iterate-pass', () => {
  beforeEach(() => {
    currentBody = {}
    dbPromptEnhanceModel = 'db-chat-model'
    dbImageModel = 'db-image-model'
    mockGrokChat.mockReset()
    mockGrokGenerateImage.mockReset()
    mockGrokListModels.mockReset()
    mockGetSystemPrompt.mockReset()
    logger.child.mockClear()
    logger.info.mockClear()
    logger.warn.mockClear()
    logger.error.mockClear()
    mockGetSystemPrompt.mockImplementation(async (_event: unknown, name: string) =>
      name === 'chat_iteration_step' ? 'step-system-prompt' : 'review-system-prompt',
    )
    mockGrokGenerateImage.mockResolvedValue({
      data: [{ url: 'https://images.example/draft.png' }],
    })
    mockGrokListModels.mockResolvedValue([{ id: 'grok-4' }, { id: 'grok-3-mini' }])
    mockPersistGeneratedImage.mockReset()
    mockPersistGeneratedImage.mockResolvedValue({
      id: 'generation-123',
      mediaUrl: '/api/media/generations/user-1/generation-123.png',
    })
  })

  it('validates the request body', async () => {
    currentBody = {
      prompt: 'test prompt',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
    }

    const handler = (await import('../../server/api/chat/iterate-pass.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      name: 'ZodError',
    })
  })

  it('returns a full pass result for long runs while trimming prior-step context', async () => {
    currentBody = {
      prompt: 'A soft portrait at sunset',
      goal: 'Make it more cinematic and specific',
      context: 'Keep the face shape matched to the preset and preserve the white background.',
      iteration: 16,
      totalIterations: 120,
      priorSteps: Array.from({ length: 15 }, (_, index) => ({
        iteration: index + 1,
        prompt: `Prompt ${index + 1}`,
        changeSummary: `Summary ${index + 1}`,
        contextSnapshot:
          'Keep the face shape matched to the preset and preserve the white background.',
        renderedPrompt: `Rendered prompt ${index + 1}`,
        imageAnalysis: `Image analysis ${index + 1}`,
      })),
      visionModel: 'grok-4',
    }
    mockGrokChat
      .mockResolvedValueOnce(
        JSON.stringify({
          revisedPrompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
          changeSummary: 'Added cinematic rim lighting and a stronger camera angle.',
          message: 'Tightened the visual direction.',
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          revisedPrompt: 'A cinematic soft portrait at sunset with tighter facial likeness cues.',
          changeSummary: 'Adjusted the next pass toward stronger likeness and more specificity.',
          imageAnalysis: 'The lighting is strong, but the facial likeness still needs refinement.',
          message: 'Shifted the next pass toward likeness accuracy.',
        }),
      )

    const handler = (await import('../../server/api/chat/iterate-pass.post')).default
    const result = await handler({} as never)

    expect(result).toEqual({
      revisedPrompt: 'A cinematic soft portrait at sunset with tighter facial likeness cues.',
      changeSummary: 'Adjusted the next pass toward stronger likeness and more specificity.',
      message: 'Shifted the next pass toward likeness accuracy.',
      contextSnapshot:
        'Keep the face shape matched to the preset and preserve the white background.',
      renderedPrompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
      generationId: 'generation-123',
      imageUrl: '/api/media/generations/user-1/generation-123.png',
      imageAnalysis: 'The lighting is strong, but the facial likeness still needs refinement.',
      generationTimeMs: expect.any(Number),
    })
    expect(mockGrokListModels).not.toHaveBeenCalled()
    expect(mockGrokGenerateImage).toHaveBeenCalledWith('test-key', {
      prompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
      model: 'db-image-model',
    })
    expect(mockPersistGeneratedImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        prompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
        remoteImageUrl: 'https://images.example/draft.png',
        failureMessage: 'Failed to save iteration image',
      }),
    )
    expect(mockGrokChat).toHaveBeenNthCalledWith(
      1,
      'test-key',
      [
        { role: 'system', content: 'step-system-prompt' },
        expect.objectContaining({
          role: 'user',
          content: expect.any(String),
        }),
      ],
      'db-chat-model',
      { type: 'json_object' },
    )
    expect(mockGrokChat).toHaveBeenNthCalledWith(
      2,
      'test-key',
      [
        { role: 'system', content: 'review-system-prompt' },
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining(
                'Prompt used to render this image:\nA cinematic soft portrait at sunset with low-angle rim light.',
              ),
            }),
            expect.objectContaining({
              type: 'image_url',
              image_url: { url: 'https://images.example/draft.png' },
            }),
          ]),
        }),
      ],
      'grok-4',
      { type: 'json_object' },
    )

    const stepContent = mockGrokChat.mock.calls[0]?.[1]?.[1]?.content
    expect(typeof stepContent).toBe('string')
    expect(stepContent).toContain('Current pass: 16 of 120')
    expect(stepContent).toContain(
      'User context:\nKeep the face shape matched to the preset and preserve the white background.',
    )
    expect(stepContent).toContain('Recent prior passes only.')
    expect(stepContent).toContain('Pass 4')
    expect(stepContent).not.toContain('Pass 3')
  })

  it('rejects malformed review output', async () => {
    currentBody = {
      prompt: 'A soft portrait at sunset',
      goal: 'Make it more cinematic and specific',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
      visionModel: 'grok-4',
    }
    mockGrokChat
      .mockResolvedValueOnce(
        JSON.stringify({
          revisedPrompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
          changeSummary: 'Added cinematic rim lighting and a stronger camera angle.',
        }),
      )
      .mockResolvedValueOnce('not-json')

    const handler = (await import('../../server/api/chat/iterate-pass.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
