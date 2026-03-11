import { z } from 'zod'
import { promptElements } from '../../database/schema'

const bodySchema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'style', 'prompt']),
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  attributes: z.string().max(20000).nullish(),
  metadata: z.string().max(10000).nullish(),
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

  const element = {
    id,
    userId: user.id,
    type: body.type,
    name: body.name,
    content: body.content,
    attributes: body.attributes ?? null,
    metadata: body.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(promptElements).values(element)

  log.info('Prompt element created', { userId: user.id, elementId: id, type: body.type })

  return element
})
