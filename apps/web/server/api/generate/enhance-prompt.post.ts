import { z } from 'zod'
import { grokEnhancePrompt } from '../../utils/grok'

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  instructions: z.string().max(1000).optional(),
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
  })

  try {
    const enhancedPrompt = await grokEnhancePrompt(config.xaiApiKey, body.prompt, body.instructions)
    log.info('Prompt enhanced successfully', { userId: user.id })
    return { enhancedPrompt }
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
