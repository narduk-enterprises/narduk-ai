import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { promptElements } from '../../database/schema'
import {
  hydratePromptElementForRead,
  normalizeChatHistoryJson,
  normalizeMetadataJson,
  normalizePresetElementState,
  resolveAttributesInputForUpdate,
} from '#server/utils/promptElementData'

const bodySchema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'style', 'prompt']).optional(),
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(100_000).optional(),
  attributes: z.string().max(100_000).nullish(),
  metadata: z.string().max(100_000).nullish(),
  chatHistory: z.string().max(500_000).nullish(),
})

/**
 * PATCH /api/elements/[id] — Update a prompt element.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('PromptElements')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'update-element', 30, 60_000)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing element ID' })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  if (
    !body.type &&
    !body.name &&
    !body.content &&
    body.attributes === undefined &&
    body.metadata === undefined &&
    body.chatHistory === undefined
  ) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const db = useDatabase(event)
  const now = new Date().toISOString()

  const existing = await db
    .select()
    .from(promptElements)
    .where(and(eq(promptElements.id, id), eq(promptElements.userId, user.id)))
    .limit(1)
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Element not found' })
  }

  const nextType = body.type ?? existing.type
  const nextName = body.name ?? existing.name
  const nextContentInput = body.content ?? existing.content
  const nextAttributesInput = resolveAttributesInputForUpdate({
    contentProvided: body.content !== undefined,
    attributes: body.attributes,
    attributesProvided: body.attributes !== undefined,
    existingAttributes: existing.attributes,
  })

  let normalizedPresetState: ReturnType<typeof normalizePresetElementState>
  let normalizedMetadata: string | null
  let normalizedChatHistory: string | null

  try {
    normalizedPresetState = normalizePresetElementState({
      type: nextType,
      name: nextName,
      content: nextContentInput,
      attributes: nextAttributesInput,
    })
    normalizedMetadata =
      body.metadata !== undefined ? normalizeMetadataJson(body.metadata ?? null) : existing.metadata
    normalizedChatHistory =
      body.chatHistory !== undefined
        ? normalizeChatHistoryJson(body.chatHistory ?? null)
        : existing.chatHistory
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Invalid prompt element payload',
    })
  }

  const result = await db
    .update(promptElements)
    .set({
      type: nextType,
      name: nextName,
      content: normalizedPresetState.content,
      attributes: normalizedPresetState.attributes,
      metadata: normalizedMetadata,
      chatHistory: normalizedChatHistory,
      updatedAt: now,
    })
    .where(and(eq(promptElements.id, id), eq(promptElements.userId, user.id)))
    .returning()
    .get()

  log.info('Prompt element updated', { userId: user.id, elementId: id })

  return hydratePromptElementForRead(result)
})
