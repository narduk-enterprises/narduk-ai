import type { H3Event } from 'h3'
import { quickModifiers } from '../database/schema'
import { eq, sql } from 'drizzle-orm'

export interface QuickModifier {
  id: string
  category: string
  label: string
  snippet: string
  sortOrder: number
  enabled: number
  usageCount: number
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
  framing: 'i-lucide-frame',
  detail: 'i-lucide-sparkles',
  quality: 'i-lucide-award',
}

const CATEGORY_ORDER = ['lighting', 'mood', 'camera', 'framing', 'detail', 'quality']

/**
 * Get all enabled quick modifiers, grouped by category.
 */
export async function getQuickModifiersByCategory(
  event: H3Event,
): Promise<QuickModifiersByCategory[]> {
  const db = useDatabase(event)
  const rows = await db.select().from(quickModifiers).where(eq(quickModifiers.enabled, 1)).all()

  const grouped: Record<string, QuickModifier[]> = {}
  const frequentlyUsed: QuickModifier[] = []

  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category]!.push(row)

    if (row.usageCount > 0) {
      frequentlyUsed.push(row)
    }
  }

  // Sort frequently used by usageCount descending, take top 15
  frequentlyUsed.sort((a, b) => b.usageCount - a.usageCount)
  const topUsed = frequentlyUsed.slice(0, 15)

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
  const results: QuickModifiersByCategory[] = allCategories.map((cat) => ({
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

  if (topUsed.length > 0) {
    results.unshift({
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

  // Can't do bulk dynamic updates easily in SQLite, so we do it in a transaction or individually.
  const statements = ids.map((id) =>
    db
      .update(quickModifiers)
      .set({ usageCount: sql`${quickModifiers.usageCount} + 1` })
      .where(eq(quickModifiers.id, id)),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- batch typing works tightly with an array literal
  await db.batch(statements as any) // `as any` because batch typing works tightly with an array literal, dynamic arrays can mismatch
}

/**
 * Get all quick modifiers (including disabled) for admin.
 */
export async function getAllQuickModifiers(event: H3Event): Promise<QuickModifier[]> {
  const db = useDatabase(event)
  return await db.select().from(quickModifiers).all()
}
