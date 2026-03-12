import { z } from 'zod'
import { parseCharacterBatchImportInput } from '~/utils/characterBatch'
import { submitCharacterImageBatch } from '#server/utils/openaiBatch'

const bodySchema = z.object({
  input: z.unknown(),
  aspectRatio: z.string().optional(),
})

/**
 * POST /api/generate/image-batch — test-only JSON import path using OpenAI Batch API.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('GenerateImageBatch')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'generate-image-batch', 3, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)
  const input = parseCharacterBatchImportInput(body.input)
  const inputCount = Array.isArray(input) ? input.length : input.characters.length

  if (!config.openaiApiKey) {
    throw createError({ statusCode: 500, message: 'OPENAI_API_KEY not configured' })
  }

  log.info('AUDIT: JSON import image batch request', {
    action: 'generate_image_batch',
    userId: user.id,
    characterCount: inputCount,
  })

  return await submitCharacterImageBatch(config.openaiApiKey, {
    input,
    aspectRatio: body.aspectRatio,
    userId: user.id,
  })
})
