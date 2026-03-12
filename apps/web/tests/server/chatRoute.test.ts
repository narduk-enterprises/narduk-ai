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
const mockGrokChatStream = vi.fn()
const mockSendStream = vi.fn((_event: unknown, stream: unknown) => stream)

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
}))

vi.mock('../../server/database/schema', () => ({
  appSettings: {
    id: 'id',
    promptEnhanceModel: 'prompt_enhance_model',
  },
}))

vi.mock('../../server/utils/grok', () => ({
  grokChat: mockGrokChat,
  grokChatStream: mockGrokChatStream,
}))

vi.mock('h3', () => ({
  sendStream: mockSendStream,
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
vi.stubGlobal('setResponseHeader', vi.fn())
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

describe('POST /api/generate/chat', () => {
  beforeEach(() => {
    currentBody = {}
    dbPromptEnhanceModel = 'db-chat-model'
    mockGrokChat.mockReset()
    mockGrokChatStream.mockReset()
    mockSendStream.mockClear()
    logger.child.mockClear()
    logger.info.mockClear()
    logger.warn.mockClear()
    logger.error.mockClear()
    mockGrokChat.mockResolvedValue(JSON.stringify({ content: 'ok' }))
    mockGrokChatStream.mockResolvedValue(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      }),
    )
  })

  it('accepts histories larger than 50 and normalizes the outbound stream payload', async () => {
    currentBody = {
      chatMode: 'general',
      stream: true,
      messages: [
        { role: 'system', content: 'system-message' },
        ...Array.from({ length: 59 }, (_, index) => ({
          role: 'user',
          content: `message-${index + 1}`,
        })),
      ],
    }

    const handler = (await import('../../server/api/generate/chat.post')).default
    const result = await handler({} as never)

    expect(result).toBeInstanceOf(ReadableStream)
    expect(mockGrokChatStream).toHaveBeenCalledTimes(1)

    const outboundMessages = mockGrokChatStream.mock.calls[0]?.[1] as Array<{
      role: string
      content: string
    }>

    expect(outboundMessages).toHaveLength(50)
    expect(outboundMessages[0]).toMatchObject({
      role: 'system',
      content: 'system-message',
    })
    expect(outboundMessages[1]).toMatchObject({
      role: 'user',
      content: 'message-11',
    })
    expect(outboundMessages.at(-1)).toMatchObject({
      role: 'user',
      content: 'message-59',
    })
  })
})
