import { z } from 'zod'
import { promptElements } from '../../database/schema'
import {
  normalizeChatHistoryJson,
  normalizeMetadataJson,
  normalizePresetElementState,
} from '#server/utils/promptElementData'
import { MAX_PROMPT_ELEMENT_CONTENT_LENGTH } from '~/utils/promptLimits'

const bodySchema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'style', 'prompt']),
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH),
  attributes: z.string().max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH).nullish(),
  metadata: z.string().max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH).nullish(),
  chatHistory: z.string().max(500_000).nullish(),
})

/**
 * POST /api/elements — Create a new prompt element.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('PromptElements')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'create-element', 30, 60_000)

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase(event)

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  let normalizedPresetState: ReturnType<typeof normalizePresetElementState>
  let normalizedMetadata: string | null
  let normalizedChatHistory: string | null

  try {
    normalizedPresetState = normalizePresetElementState({
      type: body.type,
      name: body.name,
      content: body.content,
      attributes: body.attributes ?? null,
    })
    normalizedMetadata = normalizeMetadataJson(body.metadata ?? null)
    normalizedChatHistory = normalizeChatHistoryJson(body.chatHistory ?? null)
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Invalid prompt element payload',
    })
  }

  const element = {
    id,
    userId: user.id,
    type: body.type,
    name: body.name,
    content: normalizedPresetState.content,
    attributes: normalizedPresetState.attributes,
    metadata: normalizedMetadata,
    chatHistory: normalizedChatHistory,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(promptElements).values(element)

  log.info('Prompt element created', { userId: user.id, elementId: id, type: body.type })

  return element
})
