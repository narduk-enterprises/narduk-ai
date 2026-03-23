import { z } from 'zod'
import { userPrompts } from '#server/database/schema'
import { MAX_SAVED_PROMPT_LENGTH } from '~/utils/promptLimits'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(MAX_SAVED_PROMPT_LENGTH),
  initialPresets: z.string().max(500_000).nullish(),
  chatHistory: z.string().max(500_000).nullish(),
  // Recipe fields (Phase 4)
  templateId: z.string().max(100).nullish(),
  presetMap: z.string().max(10_000).nullish(),
  modifierIds: z.string().max(10_000).nullish(),
})

/**
 * POST /api/prompts — Save a finalized prompt (optionally as a recipe).
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'create-prompt', maxRequests: 30, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const log = useLogger(event).child('UserPrompts')
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
      templateId: body.templateId ?? null,
      presetMap: body.presetMap ?? null,
      modifierIds: body.modifierIds ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(userPrompts).values(element)

    log.info('User prompt saved', {
      userId: user.id,
      promptId: id,
      isRecipe: !!(body.templateId || body.presetMap),
    })

    return element
  },
)
