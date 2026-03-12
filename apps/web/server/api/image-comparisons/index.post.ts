import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { generations, imageComparisons } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import {
  calculateComparisonScoreUpdate,
  comparisonSourceContexts,
  createGenerationComparisonDefaults,
  normalizeComparisonPairKey,
} from '#server/utils/imageComparisons'

const bodySchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  winnerId: z.string().min(1),
  sourceContext: z.enum(comparisonSourceContexts).optional().default('compare-page'),
})

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /unique|constraint/i.test(error.message)
}

/**
 * POST /api/image-comparisons — Save a unique pairwise image comparison.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'image-comparisons', 60, 60_000)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid comparison payload.' })
  }

  const { leftId, rightId, winnerId, sourceContext } = parsed.data

  if (leftId === rightId) {
    throw createError({ statusCode: 400, message: 'Select two different images.' })
  }

  if (winnerId !== leftId && winnerId !== rightId) {
    throw createError({ statusCode: 400, message: 'Winner must be one of the selected images.' })
  }

  const db = useAppDatabase(event)
  const pairKey = normalizeComparisonPairKey(leftId, rightId)

  async function loadExistingComparison() {
    return await db
      .select()
      .from(imageComparisons)
      .where(and(eq(imageComparisons.userId, user.id), eq(imageComparisons.pairKey, pairKey)))
      .get()
  }

  async function loadPairGenerations() {
    const rows = await db
      .select()
      .from(generations)
      .where(and(eq(generations.userId, user.id), inArray(generations.id, [leftId, rightId])))
      .all()

    const leftGeneration = rows.find((row) => row.id === leftId) ?? null
    const rightGeneration = rows.find((row) => row.id === rightId) ?? null

    return { leftGeneration, rightGeneration }
  }

  const existing = await loadExistingComparison()
  if (existing) {
    const { leftGeneration, rightGeneration } = await loadPairGenerations()
    return {
      alreadyExists: true,
      comparison: existing,
      leftGeneration,
      rightGeneration,
    }
  }

  const { leftGeneration, rightGeneration } = await loadPairGenerations()
  if (!leftGeneration || !rightGeneration) {
    throw createError({ statusCode: 404, message: 'One or more selected images were not found.' })
  }

  const pairRows = [leftGeneration, rightGeneration]
  const invalidRow = pairRows.find((row) => row.type !== 'image' || row.status !== 'done')
  if (invalidRow) {
    throw createError({
      statusCode: 400,
      message: 'Only completed images can be compared.',
    })
  }

  const winnerGeneration = winnerId === leftId ? leftGeneration : rightGeneration
  const loserGeneration = winnerId === leftId ? rightGeneration : leftGeneration
  const now = new Date().toISOString()

  const winnerCurrentScore =
    winnerGeneration.comparisonScore ?? createGenerationComparisonDefaults().comparisonScore
  const loserCurrentScore =
    loserGeneration.comparisonScore ?? createGenerationComparisonDefaults().comparisonScore

  const { winnerScore, loserScore } = calculateComparisonScoreUpdate(
    winnerCurrentScore,
    loserCurrentScore,
  )

  const comparison = {
    id: crypto.randomUUID(),
    userId: user.id,
    pairKey,
    leftGenerationId: leftId,
    rightGenerationId: rightId,
    winnerGenerationId: winnerGeneration.id,
    loserGenerationId: loserGeneration.id,
    sourceContext,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.insert(imageComparisons).values(comparison)
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const collision = await loadExistingComparison()
    const pair = await loadPairGenerations()

    return {
      alreadyExists: true,
      comparison: collision,
      leftGeneration: pair.leftGeneration,
      rightGeneration: pair.rightGeneration,
    }
  }

  await db
    .update(generations)
    .set({
      comparisonScore: winnerScore,
      comparisonWins: (winnerGeneration.comparisonWins ?? 0) + 1,
      lastComparedAt: now,
      updatedAt: now,
    })
    .where(eq(generations.id, winnerGeneration.id))

  await db
    .update(generations)
    .set({
      comparisonScore: loserScore,
      comparisonLosses: (loserGeneration.comparisonLosses ?? 0) + 1,
      lastComparedAt: now,
      updatedAt: now,
    })
    .where(eq(generations.id, loserGeneration.id))

  return {
    alreadyExists: false,
    comparison,
    leftGeneration: {
      ...leftGeneration,
      comparisonScore: leftGeneration.id === winnerGeneration.id ? winnerScore : loserScore,
      comparisonWins:
        leftGeneration.id === winnerGeneration.id
          ? (leftGeneration.comparisonWins ?? 0) + 1
          : (leftGeneration.comparisonWins ?? 0),
      comparisonLosses:
        leftGeneration.id === loserGeneration.id
          ? (leftGeneration.comparisonLosses ?? 0) + 1
          : (leftGeneration.comparisonLosses ?? 0),
      lastComparedAt: now,
      updatedAt: now,
    },
    rightGeneration: {
      ...rightGeneration,
      comparisonScore: rightGeneration.id === winnerGeneration.id ? winnerScore : loserScore,
      comparisonWins:
        rightGeneration.id === winnerGeneration.id
          ? (rightGeneration.comparisonWins ?? 0) + 1
          : (rightGeneration.comparisonWins ?? 0),
      comparisonLosses:
        rightGeneration.id === loserGeneration.id
          ? (rightGeneration.comparisonLosses ?? 0) + 1
          : (rightGeneration.comparisonLosses ?? 0),
      lastComparedAt: now,
      updatedAt: now,
    },
  }
})
