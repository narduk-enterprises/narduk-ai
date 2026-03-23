import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { MAX_GENERATION_PROMPT_LENGTH } from '~/utils/promptLimits'
import { generateStoredImages } from '#server/utils/imageGeneration'

const bodySchema = z.object({
  prompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  aspectRatio: z.string().optional(),
  model: z.string().optional(),
  promptElements: z.array(z.string()).optional(),
  presets: z.record(z.string(), z.string()).optional(),
  userPromptId: z.string().optional(),
  lineage: z.string().max(500_000).optional(),
})

/**
 * POST /api/generate/image — Text-to-Image generation.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'generate-image', maxRequests: 60, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const log = useLogger(event).child('Generate')
    log.info('AUDIT: T2I request', {
      action: 'generate_t2i',
      userId: user.id,
      promptLength: body.prompt.length,
    })
    const [record] = await generateStoredImages(
      event,
      {
        userId: user.id,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        model: body.model,
        promptElements: body.promptElements,
        presets: body.presets,
        userPromptId: body.userPromptId,
        lineage: body.lineage,
        n: 1,
      },
      log,
    )
    if (!record) {
      throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
    }

    log.info('T2I complete', { userId: user.id, generationId: record.id })

    return record
  },
)
