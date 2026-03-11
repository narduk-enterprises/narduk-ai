import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { promptElements } from '../../database/schema'

const bodySchema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'style', 'prompt']).optional(),
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(2000).optional(),
  attributes: z.string().max(20000).nullish(),
  metadata: z.string().max(10000).nullish(),
  chatHistory: z.string().max(100000).nullish(),
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

  const result = await db
    .update(promptElements)
    .set({
      ...(body.type && { type: body.type }),
      ...(body.name && { name: body.name }),
      ...(body.content && { content: body.content }),
      ...(body.attributes !== undefined && { attributes: body.attributes ?? null }),
      ...(body.metadata !== undefined && { metadata: body.metadata ?? null }),
      ...(body.chatHistory !== undefined && { chatHistory: body.chatHistory ?? null }),
      updatedAt: now,
    })
    .where(and(eq(promptElements.id, id), eq(promptElements.userId, user.id)))
    .returning()
    .get()

  if (!result) {
    throw createError({ statusCode: 404, message: 'Element not found' })
  }

  log.info('Prompt element updated', { userId: user.id, elementId: id })

  return result
})
