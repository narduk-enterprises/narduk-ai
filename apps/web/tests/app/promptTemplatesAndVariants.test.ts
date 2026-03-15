import { describe, expect, it } from 'vitest'

/**
 * Tests for template compilation and variant merging — pure utility logic.
 * These test the functions exported by the composables without Vue reactivity.
 */

// ─── Template Compilation ────────────────────────────────────

describe('template compilation', () => {
  // Simulate the compileTemplate function from usePromptTemplates
  function compileTemplate(
    pattern: string,
    slots: string[],
    slotContent: Record<string, string>,
  ): string {
    let result = pattern
    for (const slot of slots) {
      const placeholder = `[${slot.toUpperCase()}]`
      result = result.replaceAll(placeholder, slotContent[slot] || '')
    }
    return result
      .replaceAll(/\[\w+\]/g, '')
      .replaceAll(/\s{2,}/g, ' ')
      .replaceAll(/\.\s*\./g, '.')
      .replaceAll(/,\s*\./g, '.')
      .trim()
  }

  it('fills all slots correctly', () => {
    const result = compileTemplate(
      '[PERSON], [ACTION] in [SCENE]. [FRAMING]. [STYLE].',
      ['person', 'action', 'scene', 'framing', 'style'],
      {
        person: 'a young woman with auburn hair',
        action: 'sitting cross-legged',
        scene: 'an urban rooftop bar at golden hour',
        framing: 'medium close-up, 85mm lens',
        style: 'photorealistic, warm color grading',
      },
    )

    expect(result).toContain('a young woman with auburn hair')
    expect(result).toContain('sitting cross-legged')
    expect(result).toContain('an urban rooftop bar at golden hour')
    expect(result).toContain('medium close-up')
    expect(result).toContain('photorealistic')
  })

  it('removes unfilled slot placeholders', () => {
    const result = compileTemplate(
      '[PERSON], [ACTION] in [SCENE]. [FRAMING]. [STYLE].',
      ['person', 'action', 'scene', 'framing', 'style'],
      {
        person: 'a young woman',
        scene: 'a sunny beach',
      },
    )

    expect(result).not.toContain('[ACTION]')
    expect(result).not.toContain('[FRAMING]')
    expect(result).not.toContain('[STYLE]')
    expect(result).toContain('a young woman')
    expect(result).toContain('a sunny beach')
  })

  it('collapses double whitespace and periods', () => {
    const result = compileTemplate(
      '[PERSON]  in [SCENE].  [STYLE].',
      ['person', 'scene', 'style'],
      {
        person: 'a man',
      },
    )

    expect(result).not.toContain('  ')
  })

  it('handles portrait template (subset of slots)', () => {
    const result = compileTemplate(
      '[PERSON], looking at camera. [FRAMING]. [STYLE].',
      ['person', 'framing', 'style'],
      {
        person: 'a middle-aged man with silver hair',
        framing: 'close-up, shot on 50mm lens',
        style: 'black and white photography',
      },
    )

    expect(result).toContain('looking at camera')
    expect(result).toContain('close-up')
    expect(result).toContain('black and white photography')
  })
})

// ─── Variant Merging ─────────────────────────────────────────

describe('variant merging', () => {
  function mergeVariant(
    baseAttrs: Record<string, string>,
    variantAttrs: Record<string, string>,
  ): Record<string, string> {
    return { ...baseAttrs, ...variantAttrs }
  }

  it('overrides base attributes with variant values', () => {
    const base = {
      hair_color: 'auburn',
      clothing: 'casual tee',
      expression: 'relaxed',
    }
    const variant = {
      clothing: 'elegant evening dress',
      accessories: 'diamond necklace',
    }

    const merged = mergeVariant(base, variant)

    expect(merged.hair_color).toBe('auburn') // unchanged
    expect(merged.clothing).toBe('elegant evening dress') // overridden
    expect(merged.expression).toBe('relaxed') // unchanged
    expect(merged.accessories).toBe('diamond necklace') // added
  })

  it('preserves all base attributes not overridden', () => {
    const base = { a: '1', b: '2', c: '3' }
    const variant = { b: 'override' }

    const merged = mergeVariant(base, variant)

    expect(merged).toEqual({ a: '1', b: 'override', c: '3' })
  })

  it('handles empty variant (no overrides)', () => {
    const base = { hair_color: 'blonde' }
    const merged = mergeVariant(base, {})
    expect(merged).toEqual(base)
  })
})
