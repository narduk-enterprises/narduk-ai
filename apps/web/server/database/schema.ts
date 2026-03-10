/**
 * App-specific database schema.
 *
 * Re-exports the layer's base tables (users, sessions, todos) so that
 * drizzle-kit can discover them from this workspace. Add app-specific
 * tables below the re-export.
 */
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from '#layer/server/database/schema'

export * from '#layer/server/database/schema'

// ─── App-Specific Tables ────────────────────────────────────

export const generations = sqliteTable(
  'generations',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'image' | 'video'
    mode: text('mode').notNull(), // 't2i' | 't2v' | 'i2v' | 'i2i'
    prompt: text('prompt').notNull(),
    sourceGenerationId: text('source_generation_id'),
    status: text('status').notNull().default('pending'), // 'pending' | 'done' | 'failed' | 'expired'
    xaiRequestId: text('xai_request_id'),
    r2Key: text('r2_key'),
    mediaUrl: text('media_url'),
    thumbnailUrl: text('thumbnail_url'),
    duration: integer('duration'),
    aspectRatio: text('aspect_ratio'),
    resolution: text('resolution'),
    metadata: text('metadata'), // JSON blob
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('generations_user_id_idx').on(table.userId),
    index('generations_status_idx').on(table.status),
    index('generations_xai_request_id_idx').on(table.xaiRequestId),
  ],
)
