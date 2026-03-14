import * as schema from '#server/database/schema'

/**
 * App-level Drizzle instance with full app schema.
 * Uses the layer's createAppDatabase factory for consistent D1 binding.
 */
export const useAppDatabase = createAppDatabase(schema)
