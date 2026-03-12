import OpenAI from 'openai'
import {
  buildCharacterBatchPreviewPrompt,
  buildCharacterBatchRequests,
  mapAspectRatioToOpenAIImageSize,
  type CharacterBatchImportInput,
  type CharacterBatchSubmission,
} from '~/utils/characterBatch'

const DEFAULT_BATCH_MODEL = 'gpt-4.1-mini'
const DEFAULT_IMAGE_MODEL = 'gpt-image-1'

interface SubmitCharacterImageBatchParams {
  input: CharacterBatchImportInput
  userId: string
  aspectRatio?: string
}

export async function submitCharacterImageBatch(
  apiKey: string,
  params: SubmitCharacterImageBatchParams,
): Promise<CharacterBatchSubmission> {
  const requests = buildCharacterBatchRequests(params.input)
  const characterCount = Array.isArray(params.input)
    ? params.input.length
    : params.input.characters.length

  if (!requests.length) {
    throw createError({
      statusCode: 400,
      message: 'The imported JSON did not produce any batch requests.',
    })
  }

  const client = new OpenAI({ apiKey })
  const imageSize = mapAspectRatioToOpenAIImageSize(params.aspectRatio)
  const jsonlPayload = requests
    .map((request) =>
      JSON.stringify({
        custom_id: request.customId,
        method: 'POST',
        url: '/v1/responses',
        body: {
          model: DEFAULT_BATCH_MODEL,
          input: request.prompt,
          tool_choice: { type: 'image_generation' },
          tools: [
            {
              type: 'image_generation',
              model: request.requestedModel || DEFAULT_IMAGE_MODEL,
              size: imageSize,
              output_format: 'png',
              quality: 'high',
              moderation: 'low',
            },
          ],
          metadata: {
            source: 'generate-json-import-test',
            characterId: request.characterId,
            variant: request.variant,
            variantIndex: String(request.variantIndex),
          },
        },
      }),
    )
    .join('\n')

  const inputFile = await client.files.create({
    file: new File([jsonlPayload], `character-batch-${Date.now()}.jsonl`, {
      type: 'application/jsonl',
    }),
    purpose: 'batch',
  })

  await client.files.waitForProcessing(inputFile.id, {
    pollInterval: 1_000,
    maxWait: 30_000,
  })

  const batch = await client.batches.create({
    completion_window: '24h',
    endpoint: '/v1/responses',
    input_file_id: inputFile.id,
    metadata: {
      source: 'generate-json-import-test',
      userId: params.userId,
      characterCount: String(characterCount),
      requestCount: String(requests.length),
    },
  })

  return {
    batchId: batch.id,
    inputFileId: inputFile.id,
    status: batch.status,
    characterCount,
    requestCount: requests.length,
    submittedAt: new Date().toISOString(),
    previewPrompt: buildCharacterBatchPreviewPrompt(params.input),
    requestPreview: requests.slice(0, 10).map((request) => ({
      customId: request.customId,
      characterId: request.characterId,
      variant: request.variant,
      variantIndex: request.variantIndex,
    })),
  }
}
