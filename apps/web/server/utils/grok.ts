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
    console.error(`[grokEnhancePrompt] API error (${res.status}):`, text)
    throw createError({
      statusCode: res.status,
      message: 'Failed to enhance prompt with Grok API.',
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
    console.error(`[grokGenerateImage] API error (${res.status}):`, text)
    throw createError({
      statusCode: res.status,
      message: 'Grok image generation failed.',
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
    console.error(`[grokEditImage] API error (${res.status}):`, body)
    throw createError({
      statusCode: res.status,
      message: 'Grok image edit API failed.',
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
    throw createError({
      statusCode: res.status,
      message: 'Grok video API failed to start generation.',
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
    throw createError({
      statusCode: res.status,
      message: 'Failed to poll Grok video status.',
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

// ─── Batch API (xAI-specific REST, 50% cost savings) ─────────

interface GrokBatchState {
  num_requests: number
  num_pending: number
  num_success: number
  num_error: number
  num_cancelled: number
}

interface GrokBatchResponse {
  batch_id: string
  name: string
  create_time: string
  expire_time: string
  state: GrokBatchState
}

interface GrokBatchResult {
  request_id: string
  status: 'success' | 'error'
  output?: {
    data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
  }
  error?: { message: string }
}

interface GrokBatchResultsResponse {
  results: GrokBatchResult[]
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

/**
 * Create a batch, add an image generation request, and return the batch_id.
 * Uses the xAI batch API for ~50% cost savings on image generation.
 */
export async function grokBatchGenerateImage(
  apiKey: string,
  params: GrokImageParams,
): Promise<{ batchId: string }> {
  // 1. Create a batch
  const batchRes = await fetch('https://api.x.ai/v1/batches', {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ name: `img-${Date.now()}` }),
  })

  if (!batchRes.ok) {
    const text = await batchRes.text()
    console.error(`[grokBatchGenerateImage] Create batch error (${batchRes.status}):`, text)
    throw createError({
      statusCode: batchRes.status,
      message: 'Failed to create batch for image generation.',
    })
  }

  const batch = (await batchRes.json()) as GrokBatchResponse

  // 2. Add image generation request to the batch
  const reqRes = await fetch(`https://api.x.ai/v1/batches/${batch.batch_id}/requests`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      input: {
        model: params.model || 'grok-imagine-image',
        prompt: params.prompt,
        n: params.n || 1,
        response_format: params.response_format || 'url',
        ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
      },
    }),
  })

  if (!reqRes.ok) {
    const text = await reqRes.text()
    console.error(`[grokBatchGenerateImage] Add request error (${reqRes.status}):`, text)
    throw createError({
      statusCode: reqRes.status,
      message: 'Failed to add image request to batch.',
    })
  }

  return { batchId: batch.batch_id }
}

/**
 * Create a batch, add an image edit request, and return the batch_id.
 */
export async function grokBatchEditImage(
  apiKey: string,
  params: GrokImageEditParams,
): Promise<{ batchId: string }> {
  const batchRes = await fetch('https://api.x.ai/v1/batches', {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ name: `img-edit-${Date.now()}` }),
  })

  if (!batchRes.ok) {
    const text = await batchRes.text()
    console.error(`[grokBatchEditImage] Create batch error (${batchRes.status}):`, text)
    throw createError({
      statusCode: batchRes.status,
      message: 'Failed to create batch for image edit.',
    })
  }

  const batch = (await batchRes.json()) as GrokBatchResponse

  const reqRes = await fetch(`https://api.x.ai/v1/batches/${batch.batch_id}/requests`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      input: {
        model: params.model || 'grok-imagine-image',
        prompt: params.prompt,
        image: { url: params.imageUrl, type: 'image_url' },
      },
    }),
  })

  if (!reqRes.ok) {
    const text = await reqRes.text()
    console.error(`[grokBatchEditImage] Add request error (${reqRes.status}):`, text)
    throw createError({
      statusCode: reqRes.status,
      message: 'Failed to add image edit request to batch.',
    })
  }

  return { batchId: batch.batch_id }
}

/**
 * Poll batch status and optionally retrieve results.
 * Returns a normalized response compatible with the generation pipeline.
 */
export async function grokPollBatch(
  apiKey: string,
  batchId: string,
): Promise<{
  status: 'pending' | 'done' | 'failed'
  imageUrl?: string
  revisedPrompt?: string
  error?: { code: string; message: string }
}> {
  // Check batch status
  const statusRes = await fetch(`https://api.x.ai/v1/batches/${batchId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!statusRes.ok) {
    const text = await statusRes.text()
    console.error(`[grokPollBatch] Status check error (${statusRes.status}):`, text)
    throw createError({
      statusCode: statusRes.status,
      message: 'Failed to poll batch status.',
    })
  }

  const batch = (await statusRes.json()) as GrokBatchResponse

  // Still processing
  if (batch.state.num_pending > 0) {
    return { status: 'pending' }
  }

  // All requests errored
  if (batch.state.num_success === 0 && batch.state.num_error > 0) {
    return {
      status: 'failed',
      error: { code: 'batch_error', message: 'All batch requests failed' },
    }
  }

  // Retrieve results
  const resultsRes = await fetch(`https://api.x.ai/v1/batches/${batchId}/results`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!resultsRes.ok) {
    const text = await resultsRes.text()
    console.error(`[grokPollBatch] Results fetch error (${resultsRes.status}):`, text)
    throw createError({
      statusCode: resultsRes.status,
      message: 'Failed to retrieve batch results.',
    })
  }

  const resultsData = (await resultsRes.json()) as GrokBatchResultsResponse
  const first = resultsData.results?.[0]

  if (!first || first.status === 'error') {
    return {
      status: 'failed',
      error: {
        code: 'batch_request_error',
        message: first?.error?.message || 'Batch image generation failed',
      },
    }
  }

  const imageUrl = first.output?.data?.[0]?.url
  if (!imageUrl) {
    return {
      status: 'failed',
      error: { code: 'no_image', message: 'Batch completed but no image was returned' },
    }
  }

  return {
    status: 'done',
    imageUrl,
    revisedPrompt: first.output?.data?.[0]?.revised_prompt,
  }
}
