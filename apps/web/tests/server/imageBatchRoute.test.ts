import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCharacterBatchRequests,
  parseCharacterInputJson,
} from '../../app/utils/characterBatch'

let currentBody: Record<string, unknown> = {}

const logger = {
  child: vi.fn(() => logger),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockGenerateStoredImages = vi.fn()

vi.mock('#server/utils/imageGeneration', () => ({
  generateStoredImages: mockGenerateStoredImages,
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
  vi.fn(() => ({
    xaiImportedImageMaxConcurrent: 10,
    xaiImportedImageMaxRetries: 2,
    xaiImportedImageRetryDelayMs: 1,
  })),
)
vi.stubGlobal(
  'useLogger',
  vi.fn(() => logger),
)

describe('imported prompt arrays', () => {
  beforeEach(() => {
    currentBody = {}
    mockGenerateStoredImages.mockReset()
    logger.child.mockClear()
    logger.info.mockClear()
    logger.warn.mockClear()
    logger.error.mockClear()
  })

  it('expand into one xAI image request per imported prompt', () => {
    const parsed = parseCharacterInputJson(
      JSON.stringify([
        {
          category: 'platform_curated',
          label: 'full_smile',
          prompt_id: '4af41aa1-781d-437d-99aa-54654f786ebb',
          prompt_text: 'Photorealistic test prompt one',
        },
        {
          category: 'platform_curated',
          label: 'scene_city_sidewalk',
          prompt_id: '7b83125c-ce41-43fc-99dc-f8f6769ef76e',
          prompt_text: 'Photorealistic test prompt two',
        },
      ]),
    )

    const requests = buildCharacterBatchRequests(parsed)

    expect(requests).toHaveLength(2)
    expect(requests[0]?.prompt).toBe('Photorealistic test prompt one')
    expect(requests[1]?.prompt).toBe('Photorealistic test prompt two')
  })

  it('submits one server-side xAI request per prompt and preserves input order', async () => {
    currentBody = {
      requests: [
        {
          prompt: 'Photorealistic test prompt one',
          aspectRatio: '3:4',
          model: 'grok-imagine-image',
        },
        {
          prompt: 'Photorealistic test prompt two',
          aspectRatio: '3:4',
          model: 'grok-imagine-image',
        },
      ],
    }

    mockGenerateStoredImages.mockImplementation(async (_event, request: { prompt: string }) => {
      if (request.prompt === 'Photorealistic test prompt one') {
        await new Promise((resolve) => setTimeout(resolve, 15))
        return [{ id: 'generation-1', prompt: request.prompt }]
      }

      return [{ id: 'generation-2', prompt: request.prompt }]
    })

    const handler = (await import('../../server/api/generate/image-batch.post')).default
    const result = await handler({} as never)

    expect(mockGenerateStoredImages).toHaveBeenCalledTimes(2)
    expect(mockGenerateStoredImages).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        prompt: 'Photorealistic test prompt one',
        n: 1,
      }),
      logger,
    )
    expect(mockGenerateStoredImages).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        prompt: 'Photorealistic test prompt two',
        n: 1,
      }),
      logger,
    )
    expect(result.failures).toBe(0)
    expect(result.results).toEqual([
      { id: 'generation-1', prompt: 'Photorealistic test prompt one' },
      { id: 'generation-2', prompt: 'Photorealistic test prompt two' },
    ])
  })
})
