import { z } from 'zod'
import { definePublicMutation, withValidatedBody } from '#layer/server/utils/mutation'

const usageSchema = z.object({
  modifierIds: z.array(z.string()).min(1),
})

export default definePublicMutation(
  {
    rateLimit: { namespace: 'quick-modifier-usage', maxRequests: 120, windowMs: 60_000 },
    parseBody: withValidatedBody(usageSchema.parse),
  },
  async ({ event, body }) => {
    await incrementQuickModifierUsage(event, body.modifierIds)

    return { success: true }
  },
)
