import { beforeEach, describe, expect, it, vi } from 'vitest'

let currentBody: Record<string, unknown> = {}
let runtimeConfig = { openaiApiKey: 'openai-test-key' }

const logger = {
  child: vi.fn(() => logger),
  info: vi.fn(),
}

const mockSubmitCharacterImageBatch = vi.fn()

vi.mock('#server/utils/openaiBatch', () => ({
  submitCharacterImageBatch: mockSubmitCharacterImageBatch,
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
  vi.fn(() => runtimeConfig),
)
vi.stubGlobal(
  'useLogger',
  vi.fn(() => logger),
)

const validBody = {
  input: [
    {
      category: 'platform_curated',
      label: 'full_smile',
      prompt_id: '4af41aa1-781d-437d-99aa-54654f786ebb',
      prompt_text: 'Photorealistic test prompt one',
    },
  ],
  aspectRatio: '1:1',
}

describe('POST /api/generate/image-batch', () => {
  beforeEach(() => {
    currentBody = validBody
    runtimeConfig = { openaiApiKey: 'openai-test-key' }
    mockSubmitCharacterImageBatch.mockReset()
    logger.child.mockClear()
    logger.info.mockClear()
    mockSubmitCharacterImageBatch.mockResolvedValue({
      batchId: 'batch_123',
      inputFileId: 'file_123',
      status: 'validating',
      characterCount: 1,
      requestCount: 1,
      submittedAt: '2026-03-12T00:00:00.000Z',
      previewPrompt: 'preview',
      requestPreview: [
        {
          customId: 'character-1-ava-stone-baseline-1',
          characterId: 'ava-stone',
          variant: 'baseline',
          variantIndex: 1,
        },
      ],
    })
  })

  it('requires OPENAI_API_KEY to be configured', async () => {
    runtimeConfig = { openaiApiKey: '' }
    const handler = (await import('../../server/api/generate/image-batch.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 500,
      message: 'OPENAI_API_KEY not configured',
    })
  })

  it('validates the request body and forwards the parsed payload to the batch utility', async () => {
    const handler = (await import('../../server/api/generate/image-batch.post')).default
    const result = await handler({} as never)

    expect(mockSubmitCharacterImageBatch).toHaveBeenCalledWith('openai-test-key', {
      input: validBody.input,
      aspectRatio: '1:1',
      userId: 'user-1',
    })
    expect(result.batchId).toBe('batch_123')
    expect(result.requestCount).toBe(1)
  })
})
