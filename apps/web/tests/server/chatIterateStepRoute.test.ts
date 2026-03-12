import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentBody: Record<string, unknown> = {}
let dbPromptEnhanceModel: string | null = 'db-chat-model'

const logger = {
  child: vi.fn(() => logger),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockGrokChat = vi.fn()
const mockGetSystemPrompt = vi.fn()

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
}))

vi.mock('#server/database/schema', () => ({
  appSettings: {
    id: 'id',
    promptEnhanceModel: 'prompt_enhance_model',
  },
}))

vi.mock('#server/utils/grok', () => ({
  grokChat: mockGrokChat,
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
vi.stubGlobal(
  'useDatabase',
  vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () =>
            dbPromptEnhanceModel ? { promptEnhanceModel: dbPromptEnhanceModel } : null,
          ),
        })),
      })),
    })),
  })),
)

describe('POST /api/chat/iterate-step', () => {
  beforeEach(() => {
    currentBody = {}
    dbPromptEnhanceModel = 'db-chat-model'
    mockGrokChat.mockReset()
    mockGetSystemPrompt.mockReset()
    logger.child.mockClear()
    logger.info.mockClear()
    logger.warn.mockClear()
    logger.error.mockClear()
    mockGetSystemPrompt.mockResolvedValue('system-prompt')
  })

  it('validates the request body', async () => {
    currentBody = {
      prompt: 'test prompt',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
    }

    const handler = (await import('../../server/api/chat/iterate-step.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      name: 'ZodError',
    })
  })

  it('uses the configured fallback model and returns the normalized step payload', async () => {
    currentBody = {
      prompt: 'A soft portrait at sunset',
      goal: 'Make it more cinematic and specific',
      iteration: 52,
      totalIterations: 120,
      priorSteps: [
        {
          iteration: 51,
          prompt: 'A soft portrait at golden hour',
          changeSummary: 'Added warm golden-hour lighting.',
        },
      ],
    }
    mockGrokChat.mockResolvedValue(
      JSON.stringify({
        revisedPrompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
        changeSummary: 'Added cinematic rim lighting and a stronger camera angle.',
        message: 'Tightened the visual direction.',
      }),
    )

    const handler = (await import('../../server/api/chat/iterate-step.post')).default
    const result = await handler({} as never)

    expect(result).toEqual({
      revisedPrompt: 'A cinematic soft portrait at sunset with low-angle rim light.',
      changeSummary: 'Added cinematic rim lighting and a stronger camera angle.',
      message: 'Tightened the visual direction.',
    })
    expect(mockGetSystemPrompt).toHaveBeenCalledWith(expect.anything(), 'chat_iteration_step')
    expect(mockGrokChat).toHaveBeenCalledWith(
      'test-key',
      [
        { role: 'system', content: 'system-prompt' },
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Current pass: 52 of 120'),
        }),
      ],
      'db-chat-model',
      { type: 'json_object' },
    )
  })

  it('rejects malformed model output', async () => {
    currentBody = {
      prompt: 'A soft portrait at sunset',
      goal: 'Make it more cinematic and specific',
      iteration: 1,
      totalIterations: 5,
      priorSteps: [],
    }
    mockGrokChat.mockResolvedValue('not-json')

    const handler = (await import('../../server/api/chat/iterate-step.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
