import { z } from 'zod'
import { userPrompts } from '../../database/schema'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(3000),
  initialPresets: z.string().max(10000).nullish(),
  chatHistory: z.string().max(50000).nullish(),
})

/**
 * POST /api/prompts — Save a finalized prompt.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('UserPrompts')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'create-prompt', 30, 60_000)

  const rawBody = await readBody(event)
  const validation = bodySchema.safeParse(rawBody)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid payload',
      data: validation.error.format(),
    })
  }

  const body = validation.data
  const db = useDatabase(event)

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const element = {
    id,
    userId: user.id,
    title: body.title,
    prompt: body.prompt,
    initialPresets: body.initialPresets ?? null,
    chatHistory: body.chatHistory ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(userPrompts).values(element)

  log.info('User prompt saved', { userId: user.id, promptId: id })

  return element
})
