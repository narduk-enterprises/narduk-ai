import type { H3Event } from 'h3'
import { quickModifiers } from '../database/schema'
import { eq } from 'drizzle-orm'

export interface QuickModifier {
  id: string
  category: string
  label: string
  snippet: string
  sortOrder: number
  enabled: number
  updatedAt: string
}

export interface QuickModifiersByCategory {
  category: string
  label: string
  icon: string
  modifiers: QuickModifier[]
}

const CATEGORY_ICONS: Record<string, string> = {
  lighting: 'i-lucide-sun',
  mood: 'i-lucide-drama',
  camera: 'i-lucide-camera',
  detail: 'i-lucide-sparkles',
  quality: 'i-lucide-award',
}

const CATEGORY_ORDER = ['lighting', 'mood', 'camera', 'detail', 'quality']

/**
 * Get all enabled quick modifiers, grouped by category.
 */
export async function getQuickModifiersByCategory(
  event: H3Event,
): Promise<QuickModifiersByCategory[]> {
  const db = useDatabase(event)
  const rows = await db.select().from(quickModifiers).where(eq(quickModifiers.enabled, 1)).all()

  const grouped: Record<string, QuickModifier[]> = {}
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category]!.push(row)
  }

  // Sort within each category by sortOrder
  for (const cat of Object.keys(grouped)) {
    grouped[cat]!.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // Get all unique categories from the groups
  const allCategories = Object.keys(grouped)

  // Sort categories: put predefined ones first in CATEGORY_ORDER, then alphabetical
  allCategories.sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a)
    const indexB = CATEGORY_ORDER.indexOf(b)

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return a.localeCompare(b)
  })

  // Return in sorted order
  return allCategories.map((cat) => ({
    category: cat,
    label: CATEGORY_ORDER.includes(cat)
      ? cat.charAt(0).toUpperCase() + cat.slice(1)
      : cat
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
    icon: CATEGORY_ICONS[cat] || 'i-lucide-tag',
    modifiers: grouped[cat]!,
  }))
}

/**
 * Get all quick modifiers (including disabled) for admin.
 */
export async function getAllQuickModifiers(event: H3Event): Promise<QuickModifier[]> {
  const db = useDatabase(event)
  return await db.select().from(quickModifiers).all()
}
