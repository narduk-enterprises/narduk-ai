/**
 * Preset Schemas — single source of truth for all preset attribute definitions.
 *
 * Used by: usePresetEditor, PresetCard, useGenerationForm (modifier matching),
 * useChatForm (LLM context injection), parse-prompt API, and system prompts.
 */

// ─── Types ─────────────────────────────────────────────────

export interface AttributeField {
  key: string
  label: string
  description: string
  group?: string
}

export type PresetType = 'person' | 'scene' | 'framing' | 'action' | 'style'

// ─── Person Schema ─────────────────────────────────────────

export const PERSON_SCHEMA: AttributeField[] = [
  { key: 'name', label: 'Name', description: 'Full realistic name', group: 'identity' },
  {
    key: 'description',
    label: 'Description',
    description: '3-word evocative label',
    group: 'identity',
  },
  { key: 'age', label: 'Age', description: 'Numeric age or range', group: 'identity' },
  { key: 'gender', label: 'Gender', description: 'Gender identity', group: 'identity' },
  { key: 'ethnicity', label: 'Ethnicity', description: 'Ethnic background', group: 'identity' },
  { key: 'body_type', label: 'Body Type', description: 'Build and physique', group: 'physical' },
  { key: 'height', label: 'Height', description: 'Height description', group: 'physical' },
  { key: 'skin_tone', label: 'Skin Tone', description: 'Skin tone and texture', group: 'physical' },
  { key: 'hair_color', label: 'Hair Color', description: 'Hair color', group: 'physical' },
  {
    key: 'hair_style',
    label: 'Hair Style',
    description: 'Hair style and length',
    group: 'physical',
  },
  { key: 'eye_color', label: 'Eye Color', description: 'Eye color', group: 'physical' },
  {
    key: 'face_shape',
    label: 'Face Shape',
    description: 'Face shape and structure',
    group: 'physical',
  },
  {
    key: 'expression',
    label: 'Expression',
    description: 'Default facial expression',
    group: 'physical',
  },
  {
    key: 'breasts',
    label: 'Breasts',
    description: 'Breast size/shape if applicable',
    group: 'physical',
  },
  { key: 'clothing', label: 'Clothing', description: 'Default outfit', group: 'style' },
  { key: 'accessories', label: 'Accessories', description: 'Jewelry, bags, etc.', group: 'style' },
  { key: 'makeup', label: 'Makeup', description: 'Makeup style', group: 'style' },
  {
    key: 'tattoos_piercings',
    label: 'Tattoos & Piercings',
    description: 'Body art',
    group: 'style',
  },
  { key: 'vibe', label: 'Vibe', description: 'Overall energy and attitude', group: 'character' },
  {
    key: 'distinguishing_features',
    label: 'Distinguishing Features',
    description: 'Unique physical traits',
    group: 'character',
  },
  {
    key: 'extended_detail',
    label: 'Extended Detail',
    description: '~100-word vivid backstory/bio',
    group: 'character',
  },
  { key: 'other', label: 'Other', description: 'Any additional details', group: 'character' },
]

// ─── Scene Schema ──────────────────────────────────────────

export const SCENE_SCHEMA: AttributeField[] = [
  { key: 'name', label: 'Name', description: 'Short evocative scene name', group: 'identity' },
  {
    key: 'description',
    label: 'Description',
    description: '3-word evocative label',
    group: 'identity',
  },
  { key: 'setting', label: 'Setting', description: 'Location type', group: 'environment' },
  { key: 'time_of_day', label: 'Time of Day', description: 'Time of day', group: 'environment' },
  { key: 'weather', label: 'Weather', description: 'Weather conditions', group: 'environment' },
  { key: 'season', label: 'Season', description: 'Season', group: 'environment' },
  {
    key: 'lighting',
    label: 'Lighting',
    description: 'Light source and quality',
    group: 'atmosphere',
  },
  {
    key: 'color_palette',
    label: 'Color Palette',
    description: 'Dominant colors',
    group: 'atmosphere',
  },
  { key: 'architecture', label: 'Architecture', description: 'Building style', group: 'details' },
  { key: 'vegetation', label: 'Vegetation', description: 'Plants and greenery', group: 'details' },
  { key: 'props', label: 'Props', description: 'Objects in scene', group: 'details' },
  { key: 'atmosphere', label: 'Atmosphere', description: 'Mood and feel', group: 'atmosphere' },
  { key: 'depth', label: 'Depth', description: 'Foreground/background layers', group: 'details' },
  {
    key: 'ground_surface',
    label: 'Ground Surface',
    description: 'Ground texture',
    group: 'details',
  },
]

// ─── Framing Schema ────────────────────────────────────────

export const FRAMING_SCHEMA: AttributeField[] = [
  { key: 'name', label: 'Name', description: 'Short framing name', group: 'identity' },
  {
    key: 'description',
    label: 'Description',
    description: '3-word evocative label',
    group: 'identity',
  },
  { key: 'shot_type', label: 'Shot Type', description: 'Close-up, wide, etc.', group: 'camera' },
  {
    key: 'camera_angle',
    label: 'Camera Angle',
    description: 'Low, high, eye-level',
    group: 'camera',
  },
  {
    key: 'camera_height',
    label: 'Camera Height',
    description: 'Height relative to subject',
    group: 'camera',
  },
  { key: 'lens', label: 'Lens', description: 'Lens type', group: 'camera' },
  { key: 'focal_length', label: 'Focal Length', description: 'e.g. 35mm, 85mm', group: 'camera' },
  {
    key: 'depth_of_field',
    label: 'Depth of Field',
    description: 'Shallow, deep, etc.',
    group: 'camera',
  },
  {
    key: 'focus_point',
    label: 'Focus Point',
    description: 'What is in focus',
    group: 'composition',
  },
  {
    key: 'camera_movement',
    label: 'Camera Movement',
    description: 'Pan, dolly, static',
    group: 'composition',
  },
  {
    key: 'composition_rule',
    label: 'Composition Rule',
    description: 'Rule of thirds, etc.',
    group: 'composition',
  },
  {
    key: 'aspect_ratio',
    label: 'Aspect Ratio',
    description: 'Frame aspect ratio',
    group: 'composition',
  },
]

// ─── Action Schema ─────────────────────────────────────────

export const ACTION_SCHEMA: AttributeField[] = [
  { key: 'name', label: 'Name', description: 'Short action name', group: 'identity' },
  {
    key: 'description',
    label: 'Description',
    description: '3-word evocative label',
    group: 'identity',
  },
  {
    key: 'primary_action',
    label: 'Primary Action',
    description: 'Main activity',
    group: 'movement',
  },
  {
    key: 'body_position',
    label: 'Body Position',
    description: 'Posture and stance',
    group: 'movement',
  },
  {
    key: 'hand_placement',
    label: 'Hand Placement',
    description: 'What hands are doing',
    group: 'movement',
  },
  {
    key: 'head_direction',
    label: 'Head Direction',
    description: 'Where head faces',
    group: 'movement',
  },
  {
    key: 'facial_expression',
    label: 'Facial Expression',
    description: 'Expression during action',
    group: 'expression',
  },
  { key: 'motion_blur', label: 'Motion Blur', description: 'Motion blur level', group: 'dynamics' },
  { key: 'energy_level', label: 'Energy Level', description: 'Calm to intense', group: 'dynamics' },
  {
    key: 'interaction',
    label: 'Interaction',
    description: 'Interaction with environment',
    group: 'dynamics',
  },
  { key: 'emotion', label: 'Emotion', description: 'Emotional state', group: 'expression' },
]

// ─── Style Schema ──────────────────────────────────────────

export const STYLE_SCHEMA: AttributeField[] = [
  { key: 'name', label: 'Name', description: 'Short style name', group: 'identity' },
  {
    key: 'description',
    label: 'Description',
    description: '3-word evocative label',
    group: 'identity',
  },
  {
    key: 'art_medium',
    label: 'Art Medium',
    description: 'Photography, painting, etc.',
    group: 'visual',
  },
  { key: 'color_palette', label: 'Color Palette', description: 'Dominant colors', group: 'visual' },
  {
    key: 'lighting',
    label: 'Lighting',
    description: 'Light quality and direction',
    group: 'visual',
  },
  {
    key: 'brushwork_or_texture',
    label: 'Brushwork/Texture',
    description: 'Surface texture',
    group: 'visual',
  },
  {
    key: 'influence_or_era',
    label: 'Influence/Era',
    description: 'Art period or influence',
    group: 'context',
  },
  { key: 'mood', label: 'Mood', description: 'Emotional tone', group: 'context' },
  {
    key: 'level_of_detail',
    label: 'Level of Detail',
    description: 'Detail density',
    group: 'context',
  },
  {
    key: 'key_elements',
    label: 'Key Elements',
    description: 'Defining visual elements',
    group: 'context',
  },
]

// ─── Registry ──────────────────────────────────────────────

export const PRESET_SCHEMAS: Record<string, AttributeField[]> = {
  person: PERSON_SCHEMA,
  scene: SCENE_SCHEMA,
  framing: FRAMING_SCHEMA,
  action: ACTION_SCHEMA,
  style: STYLE_SCHEMA,
}

/**
 * Get the ordered list of attribute keys for a given preset type.
 * Returns empty array for unknown types.
 */
export function validKeysForType(type: string): string[] {
  return (PRESET_SCHEMAS[type] ?? []).map((f) => f.key)
}

/**
 * Legacy-compatible flat map: Record<string, ReadonlyArray<string>>
 * Used by usePresetEditor for backward compat.
 */
export const PRESET_ATTRIBUTES: Record<string, ReadonlyArray<string>> = Object.fromEntries(
  Object.entries(PRESET_SCHEMAS).map(([type, fields]) => [type, fields.map((f) => f.key)]),
)

// Re-exports for backward compat with usePresetEditor consumers
export const PERSON_ATTRIBUTES = PRESET_ATTRIBUTES.person!
export const SCENE_ATTRIBUTES = PRESET_ATTRIBUTES.scene!
export const FRAMING_ATTRIBUTES = PRESET_ATTRIBUTES.framing!
export const ACTION_ATTRIBUTES = PRESET_ATTRIBUTES.action!
export const STYLE_ATTRIBUTES = PRESET_ATTRIBUTES.style!

// Type alias for person attribute keys
export type PersonAttribute = (typeof PERSON_ATTRIBUTES)[number]

// ─── LLM Context Helpers ──────────────────────────────────

/**
 * Serialize all schemas into a concise string for LLM system prompt injection.
 * ~2K tokens total.
 */
export function schemaToPromptContext(): string {
  const lines: string[] = ['PRESET ATTRIBUTE SCHEMAS:']
  for (const [type, fields] of Object.entries(PRESET_SCHEMAS)) {
    const keys = fields.map((f) => f.key).join(', ')
    lines.push(
      `- ${type.charAt(0).toUpperCase() + type.slice(1)} (${fields.length} attrs): ${keys}`,
    )
  }
  return lines.join('\n')
}

/**
 * Serialize a detailed schema for a specific type (used by auto-parser & builder).
 */
export function detailedSchemaForType(type: string): string {
  const fields = PRESET_SCHEMAS[type]
  if (!fields) return `Unknown type: ${type}`
  const lines = fields.map((f) => `  - ${f.key}: ${f.description}`)
  return `${type.charAt(0).toUpperCase() + type.slice(1)} attributes:\n${lines.join('\n')}`
}

/**
 * Full detailed schemas for all types (used by auto-parser).
 */
export function allDetailedSchemas(): string {
  return Object.keys(PRESET_SCHEMAS)
    .map((type) => detailedSchemaForType(type))
    .join('\n\n')
}

/**
 * Parse a plain-text "Key: value\n" content string into a structured Record.
 * This replaces the string-parsing logic scattered across multiple files.
 */
export function parseContentToAttributes(content: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase().replaceAll(' ', '_')
      const val = line.slice(idx + 1).trim()
      if (val) attrs[key] = val
    }
  }
  return attrs
}

/**
 * Serialize a structured attributes Record back to "Key: value\n" content.
 */
export function attributesToContent(attrs: Record<string, string | null>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `${String(k).charAt(0).toUpperCase() + String(k).slice(1).replaceAll('_', ' ')}: ${v}`,
    )
    .join('\n')
}

/**
 * Describe the prompt compilation pipeline for LLM context injection.
 */
export function compilationPipelineDescription(): string {
  return `PROMPT COMPILATION ALGORITHM:
The final prompt sent to the image/video generator is assembled as follows:
1. All active preset attributes are rendered as "Key: value" lines
2. For each preset line, if a selected Quick Modifier tag matches that attribute key AND its appliesTo scope includes the preset type → the tag's snippet REPLACES the preset value
3. Original preset lines are NEVER pruned — if no tag matches, the original value is kept
4. The user's free-text prompt is inserted after the preset lines
5. Any tag snippets that didn't match a preset attribute key are appended as a comma-separated list at the end
6. Tags are scoped by (presetType, attributeKey) — e.g. scene:lighting and style:lighting are independent
You can suggest toggling specific modifiers by their attribute key (e.g. {"lighting": "golden hour", "camera_angle": "low angle"}), or changing preset attribute values, to improve the final prompt composition.`
}
