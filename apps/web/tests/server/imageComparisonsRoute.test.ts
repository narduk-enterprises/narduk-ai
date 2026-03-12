import { beforeEach, describe, expect, it, vi } from 'vitest'

type GenerationRow = {
  id: string
  userId: string
  type: 'image' | 'video'
  status: 'pending' | 'done' | 'failed' | 'expired'
  comparisonScore: number
  comparisonWins: number
  comparisonLosses: number
  updatedAt: string
}

let currentBody: Record<string, unknown> = {}
let queuedGets: unknown[] = []
let queuedAlls: unknown[] = []
let insertedRows: unknown[] = []
let updatedRows: unknown[] = []

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => queuedGets.shift() ?? null),
        all: vi.fn(async () => queuedAlls.shift() ?? []),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(async (row: unknown) => {
      insertedRows.push(row)
      return row
    }),
  })),
  update: vi.fn(() => ({
    set: vi.fn((row: unknown) => ({
      where: vi.fn(async () => {
        updatedRows.push(row)
      }),
    })),
  })),
}

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ type: 'and', args })),
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  inArray: vi.fn((...args) => ({ type: 'inArray', args })),
}))

vi.mock('#server/database/schema', () => ({
  generations: {
    id: 'id',
    userId: 'user_id',
    type: 'type',
    status: 'status',
    comparisonScore: 'comparison_score',
    comparisonWins: 'comparison_wins',
    comparisonLosses: 'comparison_losses',
    updatedAt: 'updated_at',
  },
  imageComparisons: {
    userId: 'user_id',
    pairKey: 'pair_key',
  },
}))

vi.mock('#server/utils/database', () => ({
  useAppDatabase: vi.fn(() => mockDb),
}))

vi.stubGlobal('createError', (opts: { statusCode: number; message: string }) => {
  const error = new Error(opts.message) as Error & { statusCode: number }
  error.statusCode = opts.statusCode
  return error
})
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

vi.stubGlobal(
  'requireAuth',
  vi.fn(async () => ({ id: 'user-1' })),
)
vi.stubGlobal(
  'enforceRateLimit',
  vi.fn(async () => {}),
)
vi.stubGlobal(
  'readBody',
  vi.fn(async () => currentBody),
)
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'comparison-1'),
})

function makeGenerationRow(
  overrides: Partial<GenerationRow> & Pick<GenerationRow, 'id'>,
): GenerationRow {
  return {
    id: overrides.id,
    userId: overrides.userId || 'user-1',
    type: overrides.type || 'image',
    status: overrides.status || 'done',
    comparisonScore: overrides.comparisonScore ?? 1000,
    comparisonWins: overrides.comparisonWins ?? 0,
    comparisonLosses: overrides.comparisonLosses ?? 0,
    updatedAt: overrides.updatedAt || '2026-03-12T00:00:00.000Z',
  }
}

describe('POST /api/image-comparisons', () => {
  beforeEach(() => {
    currentBody = {}
    queuedGets = []
    queuedAlls = []
    insertedRows = []
    updatedRows = []
    vi.clearAllMocks()
  })

  it('rejects selecting the same image twice', async () => {
    currentBody = {
      leftId: 'image-1',
      rightId: 'image-1',
      winnerId: 'image-1',
      sourceContext: 'compare-page',
    }

    const handler = (await import('../../server/api/image-comparisons/index.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      message: 'Select two different images.',
      statusCode: 400,
    })
  })

  it('rejects images that are not completed image rows', async () => {
    currentBody = {
      leftId: 'image-1',
      rightId: 'image-2',
      winnerId: 'image-1',
      sourceContext: 'compare-page',
    }
    queuedGets.push(null)
    queuedAlls.push([
      makeGenerationRow({ id: 'image-1', type: 'video' }),
      makeGenerationRow({ id: 'image-2' }),
    ])

    const handler = (await import('../../server/api/image-comparisons/index.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      message: 'Only completed images can be compared.',
      statusCode: 400,
    })
  })

  it('stores a new comparison and updates both image scores', async () => {
    currentBody = {
      leftId: 'image-1',
      rightId: 'image-2',
      winnerId: 'image-1',
      sourceContext: 'gallery-card',
    }
    queuedGets.push(null)
    queuedAlls.push([makeGenerationRow({ id: 'image-1' }), makeGenerationRow({ id: 'image-2' })])

    const handler = (await import('../../server/api/image-comparisons/index.post')).default
    const result = await handler({} as never)

    expect(result.alreadyExists).toBe(false)
    expect(insertedRows).toHaveLength(1)
    expect(updatedRows).toHaveLength(2)
    expect(result.leftGeneration?.comparisonScore).toBeGreaterThan(1000)
    expect(result.leftGeneration?.comparisonWins).toBe(1)
    expect(result.rightGeneration?.comparisonScore).toBeLessThan(1000)
    expect(result.rightGeneration?.comparisonLosses).toBe(1)
  })

  it('returns the locked result instead of inserting a duplicate pair', async () => {
    currentBody = {
      leftId: 'image-1',
      rightId: 'image-2',
      winnerId: 'image-2',
      sourceContext: 'compare-page',
    }
    queuedGets.push({
      id: 'comparison-existing',
      winnerGenerationId: 'image-1',
      loserGenerationId: 'image-2',
    })
    queuedAlls.push([makeGenerationRow({ id: 'image-1' }), makeGenerationRow({ id: 'image-2' })])

    const handler = (await import('../../server/api/image-comparisons/index.post')).default
    const result = await handler({} as never)

    expect(result.alreadyExists).toBe(true)
    expect(insertedRows).toHaveLength(0)
    expect(updatedRows).toHaveLength(0)
    expect(result.comparison?.winnerGenerationId).toBe('image-1')
  })
})
