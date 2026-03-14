/**
 * Grok Imagine API utility — uses the official OpenAI SDK as recommended by xAI docs.
 *
 * xAI's image generation API is OpenAI-compatible, so the official approach
 * is `new OpenAI({ baseURL: 'https://api.x.ai/v1' })`.
 *
 * Video generation uses xAI-specific REST endpoints (not in OpenAI SDK),
 * so those use native fetch.
 */

import type OpenAI from 'openai'

// ─── Outbound xAI Image Rate Limiter ────────────────────────
// xAI enforces 1 req/sec + 30 req/min for image models.
// This per-isolate queue serializes all outbound image requests
// with a minimum spacing of 1100ms between requests.
//
// NOTE: This is per-isolate (Cloudflare Workers V8 isolates do
// not share memory). It prevents a single isolate from exceeding
// the xAI rate limit, but cannot enforce global limits across
// multiple concurrent isolates. For global enforcement, use
// Cloudflare Rate Limiting Rules in the dashboard.

const XAI_IMAGE_MIN_INTERVAL_MS = 1100 // 1 req/sec with 100ms margin
let xaiImageLastRequestMs = 0
let xaiImageQueuePromise: Promise<void> = Promise.resolve()

/**
 * Acquire a rate-limit slot for an outbound xAI image API call.
 * Queues requests sequentially so at most one fires per interval.
 */
function acquireXaiImageSlot(): Promise<void> {
  xaiImageQueuePromise = xaiImageQueuePromise.then(async () => {
    const now = Date.now()
    const elapsed = now - xaiImageLastRequestMs
    if (elapsed < XAI_IMAGE_MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, XAI_IMAGE_MIN_INTERVAL_MS - elapsed))
    }
    xaiImageLastRequestMs = Date.now()
    return undefined
  })
  return xaiImageQueuePromise
}

const SYSTEM_PROMPT_COMPAT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmulti[- ]agent\b/gi, 'multi-step'],
  [/\banother agent\b/gi, 'a later continuation'],
  [/\bfor another agent\b/gi, 'to help the work resume later'],
  [/\bexpert prompt iteration agent\b/gi, 'expert prompt iteration assistant'],
  [/\bprompt iteration agent\b/gi, 'prompt iteration assistant'],
  [/\bagent\b/gi, 'assistant'],
]

function sanitizeGrokSystemContent(content: string): string {
  return SYSTEM_PROMPT_COMPAT_REPLACEMENTS.reduce(
    (nextContent, [pattern, replacement]) => nextContent.replace(pattern, replacement),
    content,
  )
}

function normalizeGrokMessages(messages: GrokChatMessage[]): GrokChatMessage[] {
  return messages.map((message) => {
    if (message.role !== 'system') return message

    if (typeof message.content === 'string') {
      return {
        ...message,
        content: sanitizeGrokSystemContent(message.content),
      }
    }

    if (!Array.isArray(message.content)) {
      return message
    }

    return {
      ...message,
      content: message.content.map((part) =>
        part.type === 'text' ? { ...part, text: sanitizeGrokSystemContent(part.text) } : part,
      ),
    }
  })
}

/**
 * Parse xAI error response body to extract a user-friendly error message.
 * xAI returns: { "code": "...", "error": "human-readable message", ... }
 */
function parseXaiError(body: string): string | null {
  try {
    const parsed = JSON.parse(body)
    return (parsed.error as string) || (parsed.message as string) || null
  } catch {
    return null
  }
}

// ─── Chat Completions (OpenAI SDK / REST) ────────────────────

export interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant'
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export async function grokChat(
  apiKey: string,
  messages: GrokChatMessage[],
  model?: string,
  responseFormat?: { type: 'json_object' | 'text' },
): Promise<string> {
  const normalizedMessages = normalizeGrokMessages(messages)
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: normalizedMessages,
      temperature: 0.7,
      ...(responseFormat && { response_format: responseFormat }),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokChat] API error (${res.status}):`, text)
    const errorMsg = parseXaiError(text) || 'Failed to chat with Grok API.'
    throw createError({
      statusCode: res.status,
      message: errorMsg,
    })
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function grokChatStream(
  apiKey: string,
  messages: GrokChatMessage[],
  model?: string,
): Promise<ReadableStream<Uint8Array>> {
  const normalizedMessages = normalizeGrokMessages(messages)
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: normalizedMessages,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokChatStream] API error (${res.status}):`, text)
    const errorMsg = parseXaiError(text) || 'Failed to chat with Grok API.'
    throw createError({
      statusCode: res.status,
      message: errorMsg,
    })
  }

  return (res.body as ReadableStream<Uint8Array>).pipeThrough(createOpenAIStreamParser())
}

function createOpenAIStreamParser() {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const data = JSON.parse(trimmed.slice(6))
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          } catch {
            // ignore invalid SSE parse errors
          }
        }
      }
    },
    flush(controller) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6))
          const content = data.choices?.[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(content))
          }
        } catch {
          // ignore trailing SSE parse errors
        }
      }
    },
  })
}

export async function grokEnhancePrompt(
  apiKey: string,
  prompt: string,
  systemContent: string,
  model?: string,
  imageBase64?: string,
): Promise<string> {
  const userContent: GrokChatMessage['content'] = imageBase64
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageBase64 } },
      ]
    : prompt

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: normalizeGrokMessages([
        {
          role: 'system',
          content: systemContent,
        },
        {
          role: 'user',
          content: userContent,
        },
      ]),
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokEnhancePrompt] API error (${res.status}):`, text)
    throw createError({
      statusCode: res.status,
      message: 'Failed to enhance prompt with Grok API.',
    })
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() || prompt
}

export async function grokEnhancePromptStream(
  apiKey: string,
  prompt: string,
  systemContent: string,
  model?: string,
  imageBase64?: string,
): Promise<ReadableStream<Uint8Array>> {
  const userContent: GrokChatMessage['content'] = imageBase64
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageBase64 } },
      ]
    : prompt

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: normalizeGrokMessages([
        {
          role: 'system',
          content: systemContent,
        },
        {
          role: 'user',
          content: userContent,
        },
      ]),
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokEnhancePromptStream] API error (${res.status}):`, text)
    throw createError({
      statusCode: res.status,
      message: 'Failed to enhance prompt with Grok API.',
    })
  }

  return (res.body as ReadableStream<Uint8Array>).pipeThrough(createOpenAIStreamParser())
}

// ─── Image Generation (OpenAI SDK) ─────────────────────────

interface GrokImageParams {
  prompt: string
  model?: string
  n?: number
  aspectRatio?: string
  response_format?: 'url' | 'b64_json'
}

interface GrokImageEditParams {
  prompt: string
  imageUrl: string
  model?: string
  resolution?: '1k' | '2k'
}

/**
 * Generate an image from a text prompt (T2I).
 * Uses the OpenAI SDK images.generate() as recommended by xAI docs.
 */
export async function grokGenerateImage(
  apiKey: string,
  params: GrokImageParams,
): Promise<OpenAI.Images.ImagesResponse> {
  // Use direct REST call instead of OpenAI SDK to support xAI-specific aspect_ratio param
  // Acquire rate-limit slot before making the request
  await acquireXaiImageSlot()
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model || 'grok-imagine-image',
      prompt: params.prompt,
      n: params.n || 1,
      response_format: params.response_format || 'url',
      ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokGenerateImage] API error (${res.status}):`, text)
    const errorMsg = parseXaiError(text) || 'Grok image generation failed.'
    throw createError({
      statusCode: res.status,
      message: errorMsg,
    })
  }

  return (await res.json()) as OpenAI.Images.ImagesResponse
}

/**
 * Edit an existing image with a text prompt (I2I).
 * NOTE: xAI does NOT support OpenAI's images.edit() (multipart/form-data).
 * Must use direct REST call with application/json as xAI docs specify.
 */
export async function grokEditImage(
  apiKey: string,
  params: GrokImageEditParams,
): Promise<OpenAI.Images.ImagesResponse> {
  // Acquire rate-limit slot before making the request
  await acquireXaiImageSlot()
  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model || 'grok-imagine-image',
      prompt: params.prompt,
      image: { url: params.imageUrl, type: 'image_url' },
      ...(params.resolution && { resolution: params.resolution }),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[grokEditImage] API error (${res.status}):`, body)
    const errorMsg = parseXaiError(body) || 'Grok image edit API failed.'
    throw createError({
      statusCode: res.status,
      message: errorMsg,
    })
  }

  return (await res.json()) as OpenAI.Images.ImagesResponse
}

// ─── Video Generation (xAI-specific REST, not in OpenAI SDK) ─

interface GrokVideoParams {
  prompt: string
  model?: string
  duration?: number
  aspect_ratio?: string
  resolution?: string
  image?: { url: string }
}

interface GrokVideoStartResponse {
  request_id: string
}

interface GrokVideoPollResponse {
  status: 'pending' | 'done' | 'failed' | 'expired'
  video?: {
    url: string
    duration: number
    respect_moderation: boolean
    coverImg?: string
  }
  model?: string
  error?: {
    code: string
    message: string
  }
}

function videoHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

/**
 * Start a video generation (T2V or I2V). Returns a request_id for polling.
 */
export async function grokStartVideo(
  apiKey: string,
  params: GrokVideoParams,
): Promise<GrokVideoStartResponse> {
  const body: Record<string, unknown> = {
    model: params.model || 'grok-imagine-video',
    prompt: params.prompt,
  }
  if (params.duration) body.duration = params.duration
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio
  if (params.resolution) body.resolution = params.resolution
  if (params.image) body.image = params.image

  const res = await fetch('https://api.x.ai/v1/videos/generations', {
    method: 'POST',
    headers: videoHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokStartVideo] API error (${res.status}):`, text)
    const errorMsg = parseXaiError(text) || 'Grok video API failed to start generation.'
    throw createError({
      statusCode: res.status,
      message: errorMsg,
    })
  }

  return (await res.json()) as GrokVideoStartResponse
}

/**
 * Poll for video generation status.
 * xAI returns two shapes:
 *   - Normal: { status: 'pending' | 'done' | 'failed' | 'expired', video?: {...} }
 *   - Error:  { code: '...', error: '...' } (e.g., content moderation rejection)
 * We normalize the error shape into GrokVideoPollResponse.
 */
export async function grokPollVideo(
  apiKey: string,
  requestId: string,
): Promise<GrokVideoPollResponse> {
  const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokPollVideo] API error (${res.status}):`, text)

    // 400 errors from xAI often contain actionable info (e.g. content moderation rejection).
    // Parse the body and return as a failed response so callers can persist the real error.
    if (res.status === 400) {
      const errorMsg = parseXaiError(text)
      return {
        status: 'failed',
        error: {
          code: 'content_moderation',
          message: errorMsg || 'Video rejected by content moderation.',
        },
      }
    }

    throw createError({
      statusCode: res.status,
      message: parseXaiError(text) || 'Failed to poll Grok video status.',
    })
  }

  const data = (await res.json()) as Record<string, unknown>

  // Normalize xAI's top-level error shape into our expected format
  if (!data.status && data.error) {
    return {
      status: 'failed',
      error: {
        code: (data.code as string) || 'unknown',
        message: (data.error as string) || 'Video generation failed',
      },
    }
  }

  return data as unknown as GrokVideoPollResponse
}

// ─── Model Discovery ─────────────────────────────────────────

export interface XaiModel {
  id: string
  object: string
  created?: number
  owned_by?: string
}

/**
 * List all models available to this API key.
 * Uses the standard OpenAI-compatible GET /v1/models endpoint.
 */
export async function grokListModels(apiKey: string): Promise<XaiModel[]> {
  const res = await fetch('https://api.x.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[grokListModels] API error (${res.status}):`, text)
    throw createError({ statusCode: res.status, message: 'Failed to list xAI models.' })
  }

  const data = (await res.json()) as { data?: XaiModel[] }
  return data.data ?? []
}

/**
 * Download media from a temporary URL and return as ArrayBuffer.
 */
export async function downloadMedia(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: `Failed to download media from ${url}`,
    })
  }
  return await res.arrayBuffer()
}
