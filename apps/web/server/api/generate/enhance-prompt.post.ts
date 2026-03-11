import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { appSettings } from '../../database/schema'
import { grokEnhancePrompt, grokEnhancePromptStream } from '../../utils/grok'
import { getSystemPrompt } from '../../utils/systemPrompts'
import { sendStream } from 'h3'

const bodySchema = z.object({
  prompt: z.string().min(1).max(20_000),

  instructions: z.string().max(20000).optional(),
  imageBase64: z.string().optional(),
  mediaType: z.enum(['image', 'video']).default('image'),
  stream: z.boolean().optional().default(false),
})

/**
 * POST /api/generate/enhance-prompt — Enhances a prompt using Grok.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('EnhancePrompt')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-enhance-prompt', 20, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('AUDIT: Enhance prompt request', {
    action: 'enhance_prompt',
    userId: user.id,
    promptLength: body.prompt.length,
    hasImage: !!body.imageBase64,
  })

  const db = useDatabase(event)

  // Fetch configured model from database
  let promptEnhanceModel = 'grok-3-mini'
  try {
    const settings = await db
      .select({ promptEnhanceModel: appSettings.promptEnhanceModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()
    if (settings?.promptEnhanceModel) {
      promptEnhanceModel = settings.promptEnhanceModel
    }
  } catch (err) {
    log.warn('Could not fetch appSettings for promptEnhanceModel', { err })
  }

  try {
    const isVideo = body.mediaType === 'video'
    const mediaLabel = isVideo ? 'video' : 'image'
    const videoGuidance = isVideo
      ? ' Since the user is generating a VIDEO prompt for Grok Imagine, emphasize motion, temporal progression, camera movement, pacing, and dynamic action in addition to visual details.'
      : ''
    const videoGuidance2 = isVideo
      ? ' Also include details about motion dynamics, temporal pacing, and camera movement to optimize for video generation.'
      : ''

    let systemContent = ''
    if (body.instructions) {
      const rawPrompt = await getSystemPrompt(event, 'enhance_with_instructions')
      systemContent = rawPrompt
        .replaceAll('{{mediaLabel}}', mediaLabel)
        .replaceAll('{{videoGuidance}}', videoGuidance)
        .replaceAll('{{instructions}}', body.instructions)
    } else {
      const rawPrompt = await getSystemPrompt(event, 'enhance_without_instructions')
      systemContent = rawPrompt
        .replaceAll('{{mediaLabel}}', mediaLabel)
        .replaceAll('{{videoGuidance}}', videoGuidance)
        .replaceAll('{{videoGuidance2}}', videoGuidance2)
    }

    if (body.stream) {
      const stream = await grokEnhancePromptStream(
        config.xaiApiKey,
        body.prompt,
        systemContent,
        promptEnhanceModel,
        body.imageBase64,
      )
      log.info('Prompt enhancement streaming started', { userId: user.id })

      // Cloudflare edge nodes buffer plain text streams by default.
      // We must explicitly disable caching and transformations.
      setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
      setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
      setResponseHeader(event, 'Connection', 'keep-alive')

      return sendStream(event, stream)
    } else {
      const enhancedPrompt = await grokEnhancePrompt(
        config.xaiApiKey,
        body.prompt,
        systemContent,
        promptEnhanceModel,
        body.imageBase64,
      )
      log.info('Prompt enhanced successfully', { userId: user.id })
      return { enhancedPrompt }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : 500
    log.error('Prompt enhancement failed', { userId: user.id, error: errorMsg })
    throw createError({
      statusCode: Number(statusCode) || 500,
      message: errorMsg || 'Failed to enhance prompt',
    })
  }
})
