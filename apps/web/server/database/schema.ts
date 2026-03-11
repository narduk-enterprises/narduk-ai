/**
 * App-specific database schema.
 *
 * Re-exports the layer's base tables (users, sessions, todos) so that
 * drizzle-kit can discover them from this workspace. Add app-specific
 * tables below the re-export.
 */
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from '../../../../layers/narduk-nuxt-layer/server/database/schema'

export * from '../../../../layers/narduk-nuxt-layer/server/database/schema'

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

export const promptElements = sqliteTable(
  'prompt_elements',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'person' | 'scene' | 'framing' | 'action'
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('prompt_elements_user_id_idx').on(table.userId),
    index('prompt_elements_type_idx').on(table.type),
  ],
)

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(), // Single-row table, always id=1
  videoModel: text('video_model').notNull().default('grok-imagine-video'),
  imageModel: text('image_model').notNull().default('grok-imagine-image'),
  promptEnhanceModel: text('prompt_enhance_model').notNull().default('grok-3-mini'),
  updatedAt: text('updated_at').notNull(),
})
