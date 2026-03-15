import { sql } from 'drizzle-orm'

/**
 * GET /api/migrate-prompt-system — One-shot migration to create
 * prompt_templates, prompt_element_variants, and add recipe columns to user_prompts.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('Migration')
  await requireAdmin(event)

  const db = useDatabase(event)

  // Create prompt_templates table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      pattern TEXT NOT NULL,
      slots TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS prompt_templates_user_id_idx ON prompt_templates(user_id)`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS prompt_templates_category_idx ON prompt_templates(category)`,
  )

  // Create prompt_element_variants table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS prompt_element_variants (
      id TEXT PRIMARY KEY NOT NULL,
      element_id TEXT NOT NULL REFERENCES prompt_elements(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      variant_attributes TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS prompt_element_variants_element_id_idx ON prompt_element_variants(element_id)`,
  )

  // Add recipe columns to user_prompts (safe: columns may already exist)
  const addColumn = async (table: string, col: string, type: string) => {
    try {
      await db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`))
    } catch {
      // Column already exists — ignore
    }
  }

  await addColumn(
    'user_prompts',
    'template_id',
    'TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL',
  )
  await addColumn('user_prompts', 'preset_map', 'TEXT')
  await addColumn('user_prompts', 'modifier_ids', 'TEXT')

  // Seed system templates
  const now = new Date().toISOString()
  const systemTemplates = [
    {
      id: 'tpl-portrait',
      name: 'Portrait',
      description: 'Classic portrait — subject fills the frame, minimal scene context',
      category: 'portrait',
      pattern: '[PERSON], looking at camera. [FRAMING]. [STYLE].',
      slots: JSON.stringify(['person', 'framing', 'style']),
    },
    {
      id: 'tpl-environmental',
      name: 'Environmental',
      description: 'Subject in a detailed environment — lifestyle, travel, editorial',
      category: 'environmental',
      pattern: '[PERSON] [ACTION] in [SCENE]. [FRAMING]. [STYLE].',
      slots: JSON.stringify(['person', 'action', 'scene', 'framing', 'style']),
    },
    {
      id: 'tpl-cinematic',
      name: 'Cinematic',
      description: 'Film-still composition — scene-first, subject in foreground',
      category: 'cinematic',
      pattern: '[SCENE]. [PERSON] in the foreground, [ACTION]. Anamorphic lens flare. [STYLE].',
      slots: JSON.stringify(['scene', 'person', 'action', 'style']),
    },
    {
      id: 'tpl-duo',
      name: 'Duo / Group',
      description: 'Two or more subjects interacting in a scene',
      category: 'duo',
      pattern: '[PERSON] and a companion, [ACTION] in [SCENE]. [FRAMING]. [STYLE].',
      slots: JSON.stringify(['person', 'action', 'scene', 'framing', 'style']),
    },
    {
      id: 'tpl-video',
      name: 'Video Clip',
      description: 'Short video — concise prompt for motion stability',
      category: 'video',
      pattern: '[PERSON] [ACTION] in [SCENE]. Camera slowly [FRAMING]. [STYLE].',
      slots: JSON.stringify(['person', 'action', 'scene', 'framing', 'style']),
    },
  ]

  for (const tpl of systemTemplates) {
    await db.run(sql`
      INSERT OR IGNORE INTO prompt_templates (id, user_id, name, description, category, pattern, slots, is_system, sort_order, created_at, updated_at)
      VALUES (${tpl.id}, NULL, ${tpl.name}, ${tpl.description}, ${tpl.category}, ${tpl.pattern}, ${tpl.slots}, 1, 0, ${now}, ${now})
    `)
  }

  log.info('Prompt system migration completed', {
    tables: ['prompt_templates', 'prompt_element_variants'],
    columns: ['user_prompts.template_id', 'user_prompts.preset_map', 'user_prompts.modifier_ids'],
    systemTemplates: systemTemplates.length,
  })

  return { ok: true, systemTemplatesSeeded: systemTemplates.length }
})
