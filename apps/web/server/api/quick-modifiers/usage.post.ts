import { z } from 'zod'

const usageSchema = z.object({
  modifierIds: z.array(z.string()).min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = usageSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: parsed.error.issues,
    })
  }

  await incrementQuickModifierUsage(event, parsed.data.modifierIds)

  return { success: true }
})
