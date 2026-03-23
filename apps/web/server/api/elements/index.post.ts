import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'
import {
  normalizeChatHistoryJson,
  normalizeMetadataJson,
  normalizePresetElementState,
} from '#server/utils/promptElementData'
import { MAX_PROMPT_ELEMENT_CONTENT_LENGTH } from '~/utils/promptLimits'
import { defineUserMutation } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'style', 'clothing', 'prompt']),
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH),
  attributes: z.string().max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH).nullish(),
  metadata: z.string().max(MAX_PROMPT_ELEMENT_CONTENT_LENGTH).nullish(),
  chatHistory: z.string().max(500_000).nullish(),
})

/**
 * POST /api/elements — Create a new prompt element.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'create-element', maxRequests: 30, windowMs: 60_000 },
  },
  async ({ event, user }) => {
    const log = useLogger(event).child('PromptElements')
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDatabase(event)

    // Check for duplicate name within the same type for this user
    const existing = await db
      .select({ id: promptElements.id })
      .from(promptElements)
      .where(
        and(
          eq(promptElements.userId, user.id),
          eq(promptElements.type, body.type),
          eq(promptElements.name, body.name),
        ),
      )
      .limit(1)
      .get()

    if (existing) {
      throw createError({
        statusCode: 409,
        message: `A ${body.type} preset named "${body.name}" already exists`,
      })
    }

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
  },
)
