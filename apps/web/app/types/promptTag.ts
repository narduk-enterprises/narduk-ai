/**
 * Shared type definitions for the prompt tag system (Quick Modifiers v2).
 *
 * Used by:
 * - Client composables: usePromptTags, usePromptCompiler, usePromptParser
 * - Server utils: quickModifiers.ts
 * - Admin: useAdminQuickModifiers
 */

export type PresetType = 'person' | 'scene' | 'framing' | 'action' | 'style'

export interface PromptTag {
  id: string
  category: string // original display category (e.g. 'hair-color')
  attributeKey: string // normalized key (e.g. 'hair_color')
  appliesTo: PresetType[] | null // null = global modifier
  selectionMode: 'single' | 'multi'
  label: string
  snippet: string
  sortOrder: number
  enabled: number
  usageCount: number
  updatedAt: string
}

export interface PromptTagCategory {
  attributeKey: string
  appliesTo: PresetType[] | null
  selectionMode: 'single' | 'multi'
  label: string
  icon: string
  tags: PromptTag[]
}
