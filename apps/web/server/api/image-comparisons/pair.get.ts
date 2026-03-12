import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { imageComparisons } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import { normalizeComparisonPairKey } from '#server/utils/imageComparisons'

const querySchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1),
})

/**
 * GET /api/image-comparisons/pair — Fetch an existing saved comparison for a pair.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = querySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid comparison query.' })
  }

  const { leftId, rightId } = parsed.data
  if (leftId === rightId) {
    throw createError({ statusCode: 400, message: 'Select two different images.' })
  }

  const db = useAppDatabase(event)
  const pairKey = normalizeComparisonPairKey(leftId, rightId)

  return (
    (await db
      .select()
      .from(imageComparisons)
      .where(and(eq(imageComparisons.userId, user.id), eq(imageComparisons.pairKey, pairKey)))
      .get()) ?? null
  )
})
