import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { appSettings } from '../../database/schema'
import { grokChatStream, type GrokChatMessage } from '../../utils/grok'

const ALLOWED_CHAT_MODELS = ['grok-3-mini', 'grok-3', 'grok-2-1212', 'grok-2-vision-1212'] as const

const contentPartSchema = z.object({
  type: z.enum(['text', 'image_url']),
  text: z.string().optional(),
  image_url: z.object({ url: z.string().min(1) }).optional(),
})

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([z.string().min(1).max(1_000_000), z.array(contentPartSchema).min(1).max(10)]),
})

const bodySchema = z.object({
  chatMode: z
    .enum(['general', 'person', 'scene', 'framing', 'action', 'style'])
    .optional()
    .default('general'),
  messages: z.array(messageSchema).max(50), // Max 50 messages in history
  stream: z.boolean().optional().default(false),
  model: z.enum(ALLOWED_CHAT_MODELS).optional(),
})

/**
 * POST /api/generate/chat — Connects to Grok for chat completions.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('ChatEndpoint')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-chat', 30, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  log.info('AUDIT: Chat generation request', {
    action: 'chat_completion',
    userId: user.id,
    mode: body.chatMode,
    messageCount: body.messages.length,
  })

  const db = useDatabase(event)

  // Client-supplied model takes priority over the DB setting (enables per-session model switching).
  // Fall back to DB setting, then hard-coded default.
  let chatModel = body.model || 'grok-3-mini'
  if (!body.model) {
    try {
      const settings = await db
        .select({ promptEnhanceModel: appSettings.promptEnhanceModel })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
        .get()
      if (settings?.promptEnhanceModel) {
        chatModel = settings.promptEnhanceModel as (typeof ALLOWED_CHAT_MODELS)[number]
      }
    } catch (err) {
      log.warn('Could not fetch appSettings for chatModel', { err })
    }
  }

  try {
    if (body.stream) {
      const stream = await grokChatStream(
        config.xaiApiKey,
        body.messages as GrokChatMessage[],
        chatModel,
      )
      log.info('Chat completion streaming started', { userId: user.id })

      // Cloudflare edge nodes buffer plain text streams by default.
      // We must explicitly disable caching and transformations.
      setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
      setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
      setResponseHeader(event, 'Connection', 'keep-alive')

      return sendStream(event, stream)
    } else {
      const responseContent = await grokChat(
        config.xaiApiKey,
        body.messages as GrokChatMessage[],
        chatModel,
        { type: 'json_object' },
      )
      log.info('Chat completion successful', { userId: user.id })
      return { content: responseContent }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : 500
    log.error('Chat completion failed', { userId: user.id, error: errorMsg })
    throw createError({
      statusCode: Number(statusCode) || 500,
      message: errorMsg || 'Failed to generate chat response',
    })
  }
})
