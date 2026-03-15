/**
 * Preset Prose Templates — deterministic conversion of structured preset
 * attributes into natural language prose optimized for Grok Imagine (Aurora).
 *
 * Aurora processes prompts as scene descriptions, not data sheets.
 * These functions convert Record<string, string> attributes into fluent
 * prose fragments that Aurora interprets more reliably.
 *
 * Used by: usePromptCompiler (prose compilation path)
 */

// ─── Metadata keys stripped from prose output ──────────────────
const EXCLUDED_KEYS = new Set(['name', 'description', 'extended_detail', 'other'])

// ─── Helpers ──────────────────────────────────────────────────

/** Filter out metadata keys and empty values */
function filterAttrs(attrs: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (!EXCLUDED_KEYS.has(key) && value && value.trim() && value.toLowerCase() !== 'none') {
      filtered[key] = value.trim()
    }
  }
  return filtered
}

/** Join non-empty strings with a separator, filtering blanks */
function joinParts(parts: (string | null | undefined)[], sep = ', '): string {
  return parts.filter((p): p is string => Boolean(p?.trim())).join(sep)
}

// ─── Person ───────────────────────────────────────────────────

export function personToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  // Identity phrase: "a 28-year-old Caucasian woman"
  const identityParts = joinParts([a.age ? `${a.age}-year-old` : null, a.ethnicity, a.gender], ' ')

  // Physical description: "with auburn wavy hair, hazel eyes, oval face"
  const physicalParts = joinParts([
    a.hair_color && a.hair_style
      ? `${a.hair_color} ${a.hair_style} hair`
      : a.hair_color
        ? `${a.hair_color} hair`
        : a.hair_style
          ? `${a.hair_style} hair`
          : null,
    a.eye_color ? `${a.eye_color} eyes` : null,
    a.skin_tone ? `${a.skin_tone} skin` : null,
    a.face_shape ? `${a.face_shape} face` : null,
    a.body_type,
    a.height,
    a.breasts,
    a.expression ? `${a.expression} expression` : null,
  ])

  // Style: "wearing a casual tee and jeans, minimal gold jewelry"
  const styleParts = joinParts([
    a.clothing ? `wearing ${a.clothing}` : null,
    a.accessories,
    a.makeup ? `${a.makeup} makeup` : null,
    a.tattoos_piercings,
  ])

  // Vibe & distinguishing features
  const vibeParts = joinParts([a.vibe, a.distinguishing_features])

  const identity = identityParts ? `a ${identityParts}` : 'a person'
  const physical = physicalParts ? ` with ${physicalParts}` : ''
  const style = styleParts ? `, ${styleParts}` : ''
  const vibe = vibeParts ? `, ${vibeParts}` : ''

  return `${identity}${physical}${style}${vibe}`
}

// ─── Scene ────────────────────────────────────────────────────

export function sceneToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  // Core: "in an urban rooftop bar at golden hour"
  const locationParts = joinParts(
    [a.setting ? `in ${a.setting}` : null, a.time_of_day ? `at ${a.time_of_day}` : null],
    ' ',
  )

  // Conditions: "overcast weather, autumn season"
  const conditionParts = joinParts([a.weather ? `${a.weather} weather` : null, a.season])

  // Atmosphere: "warm ambient lighting, moody atmosphere, warm color palette"
  const atmosphereParts = joinParts([
    a.lighting ? `${a.lighting} lighting` : null,
    a.atmosphere ? `${a.atmosphere} atmosphere` : null,
    a.color_palette ? `${a.color_palette} color palette` : null,
  ])

  // Details: "brick architecture, lush vegetation"
  const detailParts = joinParts([
    a.architecture ? `${a.architecture} architecture` : null,
    a.vegetation ? `${a.vegetation} vegetation` : null,
    a.props,
    a.ground_surface ? `${a.ground_surface} ground` : null,
    a.depth ? `${a.depth} depth` : null,
  ])

  return joinParts([locationParts, conditionParts, atmosphereParts, detailParts])
}

// ─── Framing ──────────────────────────────────────────────────

export function framingToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  const parts = joinParts([
    a.shot_type,
    a.camera_angle ? `${a.camera_angle} angle` : null,
    a.camera_height ? `${a.camera_height} height` : null,
    a.lens || a.focal_length
      ? `shot on ${joinParts([a.lens, a.focal_length ? `${a.focal_length}` : null], ' ')}`
      : null,
    a.depth_of_field ? `${a.depth_of_field} depth of field` : null,
    a.focus_point ? `focused on ${a.focus_point}` : null,
    a.camera_movement ? `${a.camera_movement} camera` : null,
    a.composition_rule,
    a.aspect_ratio ? `${a.aspect_ratio} aspect ratio` : null,
  ])

  return parts
}

// ─── Action ───────────────────────────────────────────────────

export function actionToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  const parts = joinParts([
    a.primary_action,
    a.body_position,
    a.hand_placement ? `hands ${a.hand_placement}` : null,
    a.head_direction ? `head ${a.head_direction}` : null,
    a.facial_expression ? `${a.facial_expression} expression` : null,
    a.emotion ? `${a.emotion} emotion` : null,
    a.energy_level ? `${a.energy_level} energy` : null,
    a.motion_blur ? `${a.motion_blur} motion blur` : null,
    a.interaction ? `interacting with ${a.interaction}` : null,
  ])

  return parts
}

// ─── Style ────────────────────────────────────────────────────

export function styleToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  const parts = joinParts([
    a.art_medium,
    a.color_palette ? `${a.color_palette} color palette` : null,
    a.lighting ? `${a.lighting} lighting` : null,
    a.brushwork_or_texture ? `${a.brushwork_or_texture} texture` : null,
    a.influence_or_era ? `${a.influence_or_era} influence` : null,
    a.mood ? `${a.mood} mood` : null,
    a.level_of_detail ? `${a.level_of_detail} detail` : null,
    a.key_elements,
  ])

  return parts
}

// ─── Clothing ─────────────────────────────────────────────────

export function clothingToProse(attrs: Record<string, string>): string {
  const a = filterAttrs(attrs)
  if (!Object.keys(a).length) return ''

  const parts = joinParts([
    a.fit,
    a.color,
    a.pattern && a.pattern.toLowerCase() !== 'solid' ? a.pattern : null,
    a.fabric,
    a.garment,
    a.details,
    a.footwear ? `with ${a.footwear}` : null,
    a.accessories,
    a.vibe ? `${a.vibe} vibe` : null,
  ])

  return parts ? `wearing ${parts}` : ''
}

// ─── Dispatcher ───────────────────────────────────────────────

const TYPE_TO_PROSE: Record<string, (attrs: Record<string, string>) => string> = {
  person: personToProse,
  scene: sceneToProse,
  framing: framingToProse,
  action: actionToProse,
  style: styleToProse,
  clothing: clothingToProse,
}

/**
 * Convert a preset's structured attributes to natural prose.
 * Returns empty string for unknown types or empty attributes.
 */
export function presetToProse(type: string, attrs: Record<string, string>): string {
  const fn = TYPE_TO_PROSE[type]
  if (!fn) return ''
  return fn(attrs)
}

// ─── Length Budgeting ─────────────────────────────────────────

/**
 * Priority ordering for attribute keys — lower priority keys are dropped
 * first when the prompt exceeds the length budget.
 *
 * Priority 1 (highest): core identity & scene
 * Priority 2: visual style & framing
 * Priority 3: atmosphere & details
 * Priority 4 (lowest): secondary details
 */
const LOW_PRIORITY_KEYS = new Set([
  'vegetation',
  'ground_surface',
  'depth',
  'architecture',
  'composition_rule',
  'aspect_ratio',
  'camera_height',
  'motion_blur',
  'interaction',
  'energy_level',
  'tattoos_piercings',
  'accessories',
  'makeup',
  'key_elements',
  'level_of_detail',
  'brushwork_or_texture',
  'influence_or_era',
])

/**
 * Condense attributes to stay within the Aurora length budget.
 * Drops low-priority keys first, then merges hair fields.
 */
export function budgetAttributes(
  attrs: Record<string, string>,
  currentLength: number,
  targetLength: number,
): Record<string, string> {
  if (currentLength <= targetLength) return attrs

  // Pass 1: Drop low-priority keys by filtering instead of deleting
  const condensed: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (!LOW_PRIORITY_KEYS.has(key)) {
      condensed[key] = value
    }
  }

  return condensed
}
