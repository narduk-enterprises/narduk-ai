import { describe, expect, it } from 'vitest'
import {
  normalizePresetElementState,
  resolveAttributesInputForUpdate,
} from '../../server/utils/promptElementData'

describe('prompt element normalization', () => {
  it('treats content-only updates as the new source of truth', () => {
    const existingAttributes = JSON.stringify({
      name: 'Emma Foster',
      description: 'Relatable Everyday Hottie',
      age: '25',
    })

    const nextAttributes = resolveAttributesInputForUpdate({
      contentProvided: true,
      attributes: undefined,
      attributesProvided: false,
      existingAttributes,
    })

    expect(nextAttributes).toBeNull()
  })

  it('falls back to a freeform prompt attribute for manual prose edits', () => {
    const normalized = normalizePresetElementState({
      type: 'person',
      name: 'Emma Foster',
      content:
        'Emma Foster, 25, warm hazel eyes, shoulder-length chestnut hair, casual tee and jeans.',
      attributes: null,
    })

    expect(normalized.content).toBe(
      'Emma Foster, 25, warm hazel eyes, shoulder-length chestnut hair, casual tee and jeans.',
    )
    expect(normalized.attributes).toBe(
      JSON.stringify({
        name: 'Emma Foster',
        prompt:
          'Emma Foster, 25, warm hazel eyes, shoulder-length chestnut hair, casual tee and jeans.',
      }),
    )
  })

  it('derives fresh structured attributes from manual key-value edits', () => {
    const normalized = normalizePresetElementState({
      type: 'person',
      name: 'Emma Foster',
      content: ['Name: Emma Foster', 'Description: Warm hazel brunette', 'Age: 26'].join('\n'),
      attributes: null,
    })

    expect(normalized.content).toBe(
      ['Name: Emma Foster', 'Description: Warm hazel brunette', 'Age: 26'].join('\n'),
    )
    expect(normalized.attributes).toBe(
      JSON.stringify({
        name: 'Emma Foster',
        description: 'Warm hazel brunette',
        age: '26',
      }),
    )
  })
})
