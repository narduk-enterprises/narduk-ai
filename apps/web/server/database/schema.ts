/**
 * App-specific database schema.
 *
 * Re-exports the layer's base tables (users, sessions, todos) so that
 * drizzle-kit can discover them from this workspace. Add app-specific
 * tables below the re-export.
 */
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
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
    comparisonScore: integer('comparison_score').notNull().default(1000),
    comparisonWins: integer('comparison_wins').notNull().default(0),
    comparisonLosses: integer('comparison_losses').notNull().default(0),
    lastComparedAt: text('last_compared_at'),
    duration: integer('duration'),
    generationTimeMs: integer('generation_time_ms'),
    aspectRatio: text('aspect_ratio'),
    resolution: text('resolution'),
    metadata: text('metadata'), // JSON blob
    promptElements: text('prompt_elements'), // JSON array
    presets: text('presets'), // JSON blob: Record<string, string>
    lineage: text('lineage'), // JSON blob: { presetIds, modifierIds, userPrompt, compiledPrompt, attributes }
    userPromptId: text('user_prompt_id').references(() => userPrompts.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('generations_user_id_idx').on(table.userId),
    index('generations_status_idx').on(table.status),
    index('generations_xai_request_id_idx').on(table.xaiRequestId),
    index('generations_comparison_score_idx').on(table.comparisonScore),
    // Composite indexes for gallery query performance
    index('generations_user_created_idx').on(table.userId, table.createdAt),
    index('generations_user_updated_idx').on(table.userId, table.updatedAt),
    index('generations_user_status_type_idx').on(table.userId, table.status, table.type),
  ],
)

export const imageComparisons = sqliteTable(
  'image_comparisons',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pairKey: text('pair_key').notNull(),
    leftGenerationId: text('left_generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    rightGenerationId: text('right_generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    winnerGenerationId: text('winner_generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    loserGenerationId: text('loser_generation_id')
      .notNull()
      .references(() => generations.id, { onDelete: 'cascade' }),
    sourceContext: text('source_context').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('image_comparisons_user_pair_key_idx').on(table.userId, table.pairKey),
    index('image_comparisons_user_id_idx').on(table.userId),
    index('image_comparisons_winner_generation_id_idx').on(table.winnerGenerationId),
    index('image_comparisons_created_at_idx').on(table.createdAt),
  ],
)

export const userPrompts = sqliteTable(
  'user_prompts',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    initialPresets: text('initial_presets'), // JSON blob
    chatHistory: text('chat_history'), // JSON blob
    // Recipe fields (Phase 4)
    templateId: text('template_id').references(() => promptTemplates.id, { onDelete: 'set null' }),
    presetMap: text('preset_map'), // JSON: Record<string, string> — slot type → elementId
    modifierIds: text('modifier_ids'), // JSON: string[] — selected tag IDs
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('user_prompts_user_id_idx').on(table.userId)],
)

export const promptElements = sqliteTable(
  'prompt_elements',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'person' | 'scene' | 'framing' | 'action' | 'style' | 'prompt'
    name: text('name').notNull(),
    content: text('content').notNull(),
    attributes: text('attributes'), // JSON: Record<string, string | null> — structured preset data
    metadata: text('metadata'), // JSON blob: { headshotUrl?, fullBodyUrl?, ... }
    chatHistory: text('chat_history'), // JSON blob: serialized ChatMessage[]
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

export const luckyPrompts = sqliteTable(
  'lucky_prompts',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    mediaType: text('media_type').notNull(), // 'image' | 'video'
    presets: text('presets').notNull(), // JSON: Record<string, string> (type → preset name)
    presetContent: text('preset_content').notNull(), // JSON: string[] used for prompt composition
    consumed: integer('consumed').notNull().default(0), // 0 = available, 1 = used
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('lucky_prompts_user_avail_idx').on(table.userId, table.consumed)],
)

export const systemPrompts = sqliteTable('system_prompts', {
  name: text('name').primaryKey().notNull(),
  content: text('content').notNull(),
  description: text('description').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const quickModifiers = sqliteTable(
  'quick_modifiers',
  {
    id: text('id').primaryKey().notNull(),
    category: text('category').notNull(), // original display category
    attributeKey: text('attribute_key'), // normalized: 'hair_color', 'lighting', etc.
    appliesTo: text('applies_to'), // JSON: ["person","scene"] or null for global
    selectionMode: text('selection_mode').notNull().default('single'), // 'single' | 'multi'
    label: text('label').notNull(),
    snippet: text('snippet').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: integer('enabled').notNull().default(1), // 0 = disabled, 1 = enabled
    usageCount: integer('usage_count').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('quick_modifiers_usage_idx').on(table.usageCount),
    index('quick_modifiers_attr_key_idx').on(table.attributeKey),
  ],
)

// ─── Chat Session Persistence ────────────────────────────────

export const chatSessions = sqliteTable(
  'chat_sessions',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull().default('general'), // ChatMode
    model: text('model').notNull().default('grok-3-mini'), // ChatModelId at creation
    title: text('title'), // Auto-generated from suggested_title or null
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('chat_sessions_user_id_idx').on(table.userId),
    index('chat_sessions_updated_idx').on(table.updatedAt),
  ],
)

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey().notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' (system msgs rebuilt at runtime)
    content: text('content').notNull(), // JSON: string | ContentPart[]
    parsedResponse: text('parsed_response'), // JSON: ChatMessage['parsedResponse']
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('chat_messages_session_id_idx').on(table.sessionId),
    index('chat_messages_created_idx').on(table.createdAt),
  ],
)

// ─── Prompt Templates ────────────────────────────────────────

export const promptTemplates = sqliteTable(
  'prompt_templates',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = system template
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('general'), // 'portrait' | 'environmental' | 'cinematic' | 'video' | 'duo' | 'general'
    pattern: text('pattern').notNull(), // e.g. "[PERSON], [ACTION] in [SCENE]. [FRAMING]. [STYLE]."
    slots: text('slots').notNull(), // JSON: string[] — ordered slot types e.g. ["person","action","scene","framing","style"]
    isSystem: integer('is_system').notNull().default(0), // 1 = system template, 0 = user template
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('prompt_templates_user_id_idx').on(table.userId),
    index('prompt_templates_category_idx').on(table.category),
  ],
)

// ─── Prompt Element Variants (outfits, moods, etc.) ──────────

export const promptElementVariants = sqliteTable(
  'prompt_element_variants',
  {
    id: text('id').primaryKey().notNull(),
    elementId: text('element_id')
      .notNull()
      .references(() => promptElements.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Beach Outfit", "Casual", "Formal"
    variantAttributes: text('variant_attributes').notNull(), // JSON: Record<string, string> — override attrs
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('prompt_element_variants_element_id_idx').on(table.elementId)],
)
