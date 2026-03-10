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

// ─── Chat Completions (OpenAI SDK / REST) ────────────────────
export async function grokEnhancePrompt(
  apiKey: string,
  prompt: string,
  instructions?: string,
): Promise<string> {
  const systemContent = instructions
    ? `You are an expert prompt engineer for AI image and video generation. Your task is to take a simple user prompt and enhance it into a highly detailed, cinematic, and descriptive prompt that will produce stunning results. Look at the specific user instructions provided to guide your enhancement:\n\nUser Instructions: ${instructions}\n\nFocus on fulfilling the user instructions while adding details about lighting, camera angle, atmosphere, style, and subject specifics. Return ONLY the enhanced prompt text, with no introductory or conversational filler. Do not wrap in quotes.`
    : 'You are an expert prompt engineer for AI image and video generation. Your task is to take a simple user prompt and enhance it into a highly detailed, cinematic, and descriptive prompt that will produce stunning results. Focus on adding details about lighting, camera angle, atmosphere, style, and subject specifics. Return ONLY the enhanced prompt text, with no introductory or conversational filler. Do not wrap in quotes.'

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content: systemContent,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw createError({
      statusCode: res.status,
      message: `Grok chat completion error: ${text}`,
    })
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() || prompt
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
    throw createError({
      statusCode: res.status,
      message: `Grok image generation error: ${text}`,
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
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw createError({
      statusCode: res.status,
      message: `Grok image edit API error: ${body}`,
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
    throw createError({
      statusCode: res.status,
      message: `Grok video API error: ${text}`,
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
    throw createError({
      statusCode: res.status,
      message: `Grok video poll error: ${text}`,
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
