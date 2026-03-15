import { describe, expect, it } from 'vitest'
import { lintPrompt } from '../../app/utils/promptLint'

describe('promptLint', () => {
  it('returns no warnings for clean prompts', () => {
    const result = lintPrompt(
      'A photorealistic portrait of a woman with auburn hair, sharp focus, natural lighting.',
    )
    // Only check for negative phrasing warnings (length warnings depend on char count)
    const negativeWarnings = result.filter((w) => w.message.includes('Negative'))
    expect(negativeWarnings).toHaveLength(0)
  })

  it('flags "no blur" as negative phrasing', () => {
    const result = lintPrompt('A beautiful photo with no blur')
    const negWarnings = result.filter((w) => w.message.includes('no blur'))
    expect(negWarnings.length).toBeGreaterThan(0)
    expect(negWarnings[0]!.suggestion).toContain('sharp focus')
  })

  it('flags "no anime" as negative phrasing', () => {
    const result = lintPrompt('Photorealistic portrait, no anime')
    const negWarnings = result.filter((w) => w.message.includes('no anime'))
    expect(negWarnings.length).toBeGreaterThan(0)
    expect(negWarnings[0]!.suggestion).toContain('photorealistic')
  })

  it('flags "without blur" and suggests positive alternative', () => {
    const result = lintPrompt('Portrait without blur')
    const negWarnings = result.filter((w) => w.message.includes('without blur'))
    expect(negWarnings.length).toBeGreaterThan(0)
    expect(negWarnings[0]!.suggestion).toContain('sharp focus')
  })

  it('flags "avoid" phrasing', () => {
    const result = lintPrompt('Avoid oversaturation in the colors')
    const negWarnings = result.filter((w) => w.message.includes('Avoid'))
    expect(negWarnings.length).toBeGreaterThan(0)
  })

  it('flags "don\'t include" phrasing', () => {
    const result = lintPrompt("don't include any text")
    const negWarnings = result.filter((w) => w.message.includes("don't include"))
    expect(negWarnings.length).toBeGreaterThan(0)
  })

  it('flags length warning for prompts over 1000 chars', () => {
    const longPrompt = 'A'.repeat(1100)
    const result = lintPrompt(longPrompt)
    const lengthWarnings = result.filter((w) => w.message.includes('characters'))
    expect(lengthWarnings.length).toBeGreaterThan(0)
    expect(lengthWarnings[0]!.severity).toBe('warning')
  })

  it('flags length caution for prompts between 800-1000 chars', () => {
    const mediumPrompt = 'A'.repeat(900)
    const result = lintPrompt(mediumPrompt)
    const lengthWarnings = result.filter((w) => w.message.includes('characters'))
    expect(lengthWarnings.length).toBeGreaterThan(0)
    expect(lengthWarnings[0]!.severity).toBe('caution')
  })

  it('gives no length warning for prompts under 800 chars', () => {
    const shortPrompt = 'A'.repeat(500)
    const result = lintPrompt(shortPrompt)
    const lengthWarnings = result.filter((w) => w.message.includes('characters'))
    expect(lengthWarnings).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(lintPrompt('')).toHaveLength(0)
  })

  it('handles multiple negative patterns in the same prompt', () => {
    const result = lintPrompt('no blur, no noise, no artifacts')
    const negWarnings = result.filter((w) => w.message.includes('Negative phrasing'))
    expect(negWarnings.length).toBeGreaterThanOrEqual(3)
  })
})
