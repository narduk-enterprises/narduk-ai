/**
 * Preset attribute schemas for server-side use.
 *
 * Mirrors the attribute keys defined in app/utils/presetSchemas.ts.
 * If you change attribute keys in the client schema registry,
 * update this file as well.
 */

const PRESET_SCHEMA_KEYS: Record<string, readonly string[]> = {
  person: [
    'name',
    'description',
    'age',
    'gender',
    'ethnicity',
    'body_type',
    'height',
    'skin_tone',
    'hair_color',
    'hair_style',
    'eye_color',
    'face_shape',
    'expression',
    'breasts',
    'clothing',
    'accessories',
    'makeup',
    'tattoos_piercings',
    'vibe',
    'distinguishing_features',
    'extended_detail',
    'other',
  ],
  scene: [
    'name',
    'description',
    'setting',
    'time_of_day',
    'weather',
    'season',
    'lighting',
    'color_palette',
    'architecture',
    'vegetation',
    'props',
    'atmosphere',
    'depth',
    'ground_surface',
  ],
  framing: [
    'name',
    'description',
    'shot_type',
    'camera_angle',
    'camera_height',
    'lens',
    'focal_length',
    'depth_of_field',
    'focus_point',
    'camera_movement',
    'composition_rule',
    'aspect_ratio',
  ],
  action: [
    'name',
    'description',
    'primary_action',
    'body_position',
    'hand_placement',
    'head_direction',
    'facial_expression',
    'motion_blur',
    'energy_level',
    'interaction',
    'emotion',
  ],
  style: [
    'name',
    'description',
    'art_medium',
    'color_palette',
    'lighting',
    'brushwork_or_texture',
    'influence_or_era',
    'mood',
    'level_of_detail',
    'key_elements',
  ],
}

/**
 * Generate a schema description string for LLM system prompts.
 * Used by parse-prompt and other server-side endpoints.
 */
export function serverSchemaContext(): string {
  return Object.entries(PRESET_SCHEMA_KEYS)
    .map(([type, keys]) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1)
      return `${label} attributes:\n  - ${keys.join(', ')}`
    })
    .join('\n\n')
}
