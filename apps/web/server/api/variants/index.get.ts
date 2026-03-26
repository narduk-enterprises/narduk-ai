import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { promptElementVariants } from '#server/database/schema'

type PromptElementVariantRow = typeof promptElementVariants.$inferSelect

const querySchema = z.object({
  elementId: z.string().min(1),
})

/**
 * GET /api/variants — List variants for a given element.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const db = useDatabase(event)

  const rawQuery = getQuery(event)
  const query = querySchema.parse(rawQuery)

  const rows: PromptElementVariantRow[] = await db
    .select()
    .from(promptElementVariants)
    .where(eq(promptElementVariants.elementId, query.elementId))
    .orderBy(promptElementVariants.sortOrder)

  return rows.map((row) => ({
    ...row,
    variantAttributes: JSON.parse(row.variantAttributes) as Record<string, string>,
  }))
})
