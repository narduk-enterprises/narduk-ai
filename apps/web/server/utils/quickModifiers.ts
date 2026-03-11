import type { H3Event } from 'h3'
import { quickModifiers } from '../database/schema'
import { eq, sql } from 'drizzle-orm'

export interface QuickModifier {
  id: string
  category: string
  attributeKey: string | null
  appliesTo: string | null
  selectionMode: string
  label: string
  snippet: string
  sortOrder: number
  enabled: number
  usageCount: number
  updatedAt: string
}

export interface QuickModifiersByCategory {
  attributeKey: string
  appliesTo: string[] | null
  selectionMode: 'single' | 'multi'
  category: string
  label: string
  icon: string
  modifiers: QuickModifier[]
}

const CATEGORY_ICONS: Record<string, string> = {
  lighting: 'i-lucide-sun',
  mood: 'i-lucide-drama',
  camera: 'i-lucide-camera',
  framing: 'i-lucide-frame',
  detail: 'i-lucide-sparkles',
  quality: 'i-lucide-award',
  body_type: 'i-lucide-person-standing',
  gender: 'i-lucide-users',
  ethnicity: 'i-lucide-globe',
  height: 'i-lucide-ruler',
  skin_tone: 'i-lucide-palette',
  hair_color: 'i-lucide-paintbrush',
  hair_style: 'i-lucide-scissors',
  eye_color: 'i-lucide-eye',
  face_shape: 'i-lucide-scan-face',
  expression: 'i-lucide-smile',
  clothing: 'i-lucide-shirt',
  accessories: 'i-lucide-gem',
  makeup: 'i-lucide-sparkle',
  tattoos_piercings: 'i-lucide-pen-tool',
  age: 'i-lucide-calendar',
  vibe: 'i-lucide-zap',
  distinguishing_features: 'i-lucide-fingerprint',
  setting: 'i-lucide-map-pin',
  time_of_day: 'i-lucide-clock',
  weather: 'i-lucide-cloud',
  season: 'i-lucide-leaf',
  atmosphere: 'i-lucide-wind',
  color_palette: 'i-lucide-palette',
  shot_type: 'i-lucide-frame',
  camera_angle: 'i-lucide-rotate-3d',
  lens: 'i-lucide-aperture',
  focal_length: 'i-lucide-focus',
  depth_of_field: 'i-lucide-layers',
  primary_action: 'i-lucide-play',
  body_position: 'i-lucide-move',
  hand_placement: 'i-lucide-hand',
  head_direction: 'i-lucide-arrow-up-right',
  facial_expression: 'i-lucide-smile-plus',
  art_medium: 'i-lucide-brush',
  influence_or_era: 'i-lucide-history',
  level_of_detail: 'i-lucide-scan',
  breasts: 'i-lucide-circle',
}

/** Preferred display order for categories — known ones first, then alphabetical */
const CATEGORY_ORDER = [
  // Global enhancers first
  'lighting',
  'mood',
  'camera',
  'detail',
  'quality',
  // Person attributes
  'gender',
  'age',
  'ethnicity',
  'body_type',
  'height',
  'skin_tone',
  'hair_color',
  'hair_style',
  'eye_color',
  'face_shape',
  'expression',
  'clothing',
  'accessories',
  'makeup',
  'tattoos_piercings',
  'vibe',
  'distinguishing_features',
  // Scene
  'setting',
  'atmosphere',
  'weather',
  'time_of_day',
  'season',
  'color_palette',
  // Framing
  'shot_type',
  'camera_angle',
  'lens',
  'focal_length',
  'depth_of_field',
  // Action
  'primary_action',
  'body_position',
  'hand_placement',
  'head_direction',
  'facial_expression',
  // Style
  'art_medium',
  'influence_or_era',
  'level_of_detail',
]

/**
 * Get all enabled quick modifiers, grouped by attribute_key.
 */
export async function getQuickModifiersByCategory(
  event: H3Event,
): Promise<QuickModifiersByCategory[]> {
  const db = useDatabase(event)
  const rows = await db.select().from(quickModifiers).where(eq(quickModifiers.enabled, 1)).all()

  const grouped: Record<string, QuickModifier[]> = {}
  const frequentlyUsed: QuickModifier[] = []
  // Track metadata per attribute_key
  const metaByKey: Record<
    string,
    { appliesTo: string | null; selectionMode: string; category: string }
  > = {}

  for (const row of rows) {
    const key = row.attributeKey || row.category
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(row)

    if (!metaByKey[key]) {
      metaByKey[key] = {
        appliesTo: row.appliesTo,
        selectionMode: row.selectionMode,
        category: row.category,
      }
    }

    if (row.usageCount > 0) {
      frequentlyUsed.push(row)
    }
  }

  // Sort frequently used by usageCount descending, take top 15
  frequentlyUsed.sort((a, b) => b.usageCount - a.usageCount)
  const topUsed = frequentlyUsed.slice(0, 15)

  // Sort within each category by sortOrder
  for (const key of Object.keys(grouped)) {
    grouped[key]!.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // Get all unique attribute keys
  const allKeys = Object.keys(grouped)

  // Sort: predefined order first, then alphabetical
  allKeys.sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a)
    const indexB = CATEGORY_ORDER.indexOf(b)

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return a.localeCompare(b)
  })

  function formatLabel(key: string): string {
    return key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  function parseAppliesTo(raw: string | null): string[] | null {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const results: QuickModifiersByCategory[] = allKeys.map((key) => {
    const meta = metaByKey[key]
    return {
      attributeKey: key,
      appliesTo: parseAppliesTo(meta?.appliesTo || null),
      selectionMode: (meta?.selectionMode || 'single') as 'single' | 'multi',
      category: meta?.category || key,
      label: formatLabel(key),
      icon: CATEGORY_ICONS[key] || 'i-lucide-tag',
      modifiers: grouped[key]!,
    }
  })

  if (topUsed.length > 0) {
    results.unshift({
      attributeKey: 'frequently_used',
      appliesTo: null,
      selectionMode: 'multi',
      category: 'frequently-used',
      label: 'Frequently Used',
      icon: 'i-lucide-flame',
      modifiers: topUsed,
    })
  }

  return results
}

/**
 * Update quick modifier usage counts
 */
export async function incrementQuickModifierUsage(event: H3Event, ids: string[]): Promise<void> {
  const db = useDatabase(event)
  if (!ids.length) return

  const statements = ids.map((id) =>
    db
      .update(quickModifiers)
      .set({ usageCount: sql`${quickModifiers.usageCount} + 1` })
      .where(eq(quickModifiers.id, id)),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- batch typing works tightly with an array literal
  await db.batch(statements as any)
}

/**
 * Get all quick modifiers (including disabled) for admin.
 */
export async function getAllQuickModifiers(event: H3Event): Promise<QuickModifier[]> {
  const db = useDatabase(event)
  return await db.select().from(quickModifiers).all()
}
