import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { appSettings } from '../../database/schema'
import { grokChat, type GrokChatMessage } from '../../utils/grok'

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20), // Max 20 messages in history
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
    messageCount: body.messages.length,
  })

  const db = useDatabase(event)

  // Fetch configured model from database
  let chatModel = 'grok-3-mini'
  try {
    const settings = await db
      .select({ promptEnhanceModel: appSettings.promptEnhanceModel })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .get()
    if (settings?.promptEnhanceModel) {
      chatModel = settings.promptEnhanceModel
    }
  } catch (err) {
    log.warn('Could not fetch appSettings for chatModel', { err })
  }

  try {
    const responseContent = await grokChat(
      config.xaiApiKey,
      body.messages as GrokChatMessage[],
      chatModel,
    )
    log.info('Chat completion successful', { userId: user.id })
    return { content: responseContent }
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
