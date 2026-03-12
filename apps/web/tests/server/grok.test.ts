import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  grokChat,
  grokEnhancePrompt,
  grokGenerateImage,
  grokEditImage,
  grokStartVideo,
  grokPollVideo,
} from '../../server/utils/grok'

// Mock Nitro auto-imports
vi.stubGlobal('createError', (opts: { statusCode: number; message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {}) // Silence logs in tests
})

describe('grok server utilities error handling', () => {
  const API_KEY = 'test-key'

  it('grokChat sanitizes provider-incompatible multi-agent phrasing in system prompts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    })

    await grokChat(
      API_KEY,
      [
        {
          role: 'system',
          content:
            'You are an expert prompt iteration agent. Help another agent continue the work.',
        },
        { role: 'user', content: 'Make this prompt better.' },
      ],
      'grok-3-mini',
      { type: 'json_object' },
    )

    const request = mockFetch.mock.calls[0]?.[1] as { body?: string }
    const payload = JSON.parse(request.body || '{}') as {
      messages?: Array<{ role: string; content: string }>
    }

    expect(payload.messages?.[0]).toMatchObject({
      role: 'system',
      content:
        'You are an expert prompt iteration assistant. Help a later continuation continue the work.',
    })
  })

  it('grokEnhancePrompt wraps raw errors with a generic message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error with sensitive stack trace',
    })

    await expect(grokEnhancePrompt(API_KEY, 'test')).rejects.toThrow(
      'Failed to enhance prompt with Grok API.',
    )
  })

  it('grokGenerateImage wraps raw errors with a generic message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request: invalid aspect_ratio',
    })

    await expect(grokGenerateImage(API_KEY, { prompt: 'test' })).rejects.toThrow(
      'Grok image generation failed.',
    )
  })

  it('grokEditImage wraps raw errors with a generic message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      text: async () => 'Payload too large',
    })

    await expect(
      grokEditImage(API_KEY, { prompt: 'test', imageUrl: 'data:image/png;base64,...' }),
    ).rejects.toThrow('Grok image edit API failed.')
  })

  it('grokStartVideo wraps raw errors with a generic message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden: out of credits',
    })

    await expect(grokStartVideo(API_KEY, { prompt: 'test' })).rejects.toThrow(
      'Grok video API failed to start generation.',
    )
  })

  it('grokPollVideo wraps raw errors with a generic message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway: GPU cluster unreachable',
    })

    await expect(grokPollVideo(API_KEY, 'req-id')).rejects.toThrow(
      'Failed to poll Grok video status.',
    )
  })
})
