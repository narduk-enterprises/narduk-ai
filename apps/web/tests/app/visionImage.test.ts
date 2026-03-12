import { describe, expect, it, vi } from 'vitest'

import {
  VISION_MODEL,
  blobToDataUrl,
  messageContainsImage,
  payloadNeedsVision,
  resolveVisionImageUrl,
  shouldInlineVisionImage,
} from '../../app/utils/visionImage'

function createMockReader(result: string | ArrayBuffer | null, error?: Error) {
  const reader = {
    error,
    onerror: null as null | (() => void),
    onload: null as null | (() => void),
    readAsDataURL() {
      queueMicrotask(() => {
        if (error) {
          reader.onerror?.()
          return
        }

        reader.result = result
        reader.onload?.()
      })
    },
    result: null as string | ArrayBuffer | null,
  }

  return reader
}

describe('vision image helpers', () => {
  it('detects when a payload needs the vision model', () => {
    expect(VISION_MODEL).toBe('grok-2-vision-1212')

    expect(
      payloadNeedsVision([
        { content: 'plain text' },
        { content: [{ type: 'text', text: 'caption only' }] },
      ]),
    ).toBe(false)

    expect(
      messageContainsImage({
        content: [
          { type: 'text', text: 'look at this' },
          { type: 'image_url', image_url: { url: '/api/media/example.png' } },
        ],
      }),
    ).toBe(true)
  })

  it('only inlines local or same-origin image URLs', () => {
    expect(shouldInlineVisionImage('data:image/png;base64,abc', 'https://app.test')).toBe(false)
    expect(shouldInlineVisionImage('blob:abc123', 'https://app.test')).toBe(true)
    expect(shouldInlineVisionImage('/api/media/example.png', 'https://app.test')).toBe(true)
    expect(
      shouldInlineVisionImage('https://app.test/api/media/example.png', 'https://app.test'),
    ).toBe(true)
    expect(shouldInlineVisionImage('https://cdn.example.com/example.png', 'https://app.test')).toBe(
      false,
    )
  })

  it('encodes fetched local images as data URLs for vision payloads', async () => {
    const fetchImpl = vi.fn(async () => ({
      blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
      ok: true,
    }))

    const result = await resolveVisionImageUrl(
      '/api/media/example.png',
      'https://app.test',
      fetchImpl,
      () => createMockReader('data:image/png;base64,ZmFrZQ=='),
    )

    expect(result).toBe('data:image/png;base64,ZmFrZQ==')
    expect(fetchImpl).toHaveBeenCalledWith('/api/media/example.png', { credentials: 'include' })
  })

  it('passes through already public remote images without refetching', async () => {
    const fetchImpl = vi.fn()

    const result = await resolveVisionImageUrl(
      'https://cdn.example.com/example.png',
      'https://app.test',
      fetchImpl,
      () => createMockReader('unused'),
    )

    expect(result).toBe('https://cdn.example.com/example.png')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces reader failures while encoding image blobs', async () => {
    await expect(
      blobToDataUrl(new Blob(['image-bytes']), () => createMockReader(null, new Error('boom'))),
    ).rejects.toThrow('boom')
  })
})
