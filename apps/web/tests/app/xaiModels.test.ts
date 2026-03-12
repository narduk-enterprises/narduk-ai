import { describe, expect, it } from 'vitest'

import {
  buildXaiModelCatalog,
  isVisionCapableChatModel,
  pickPreferredModel,
} from '../../app/utils/xaiModels'

describe('xAI model catalog helpers', () => {
  it('classifies grok-4 family models as vision-capable chat models', () => {
    expect(isVisionCapableChatModel('grok-4')).toBe(true)
    expect(isVisionCapableChatModel('grok-4.20-beta-latest-non-reasoning')).toBe(true)
    expect(isVisionCapableChatModel('grok-3-mini')).toBe(false)
  })

  it('picks the first preferred model that is actually available', () => {
    expect(
      pickPreferredModel(
        ['grok-4', 'grok-3-mini'],
        ['grok-4.20-beta-latest-non-reasoning', 'grok-4'],
      ),
    ).toBe('grok-4')

    expect(pickPreferredModel([], ['grok-4'])).toBeNull()
  })

  it('builds a capability-aware catalog with preferred defaults', () => {
    const catalog = buildXaiModelCatalog([
      'grok-imagine-video',
      'grok-4.20-beta-latest-non-reasoning',
      'grok-imagine-image',
      'grok-3-mini',
      'grok-4',
    ])

    expect(catalog.imageModels).toEqual(['grok-imagine-image'])
    expect(catalog.videoModels).toEqual(['grok-imagine-video'])
    expect(catalog.chatModels).toEqual([
      'grok-3-mini',
      'grok-4',
      'grok-4.20-beta-latest-non-reasoning',
    ])
    expect(catalog.visionModels).toEqual(['grok-4', 'grok-4.20-beta-latest-non-reasoning'])
    expect(catalog.preferredImageModel).toBe('grok-imagine-image')
    expect(catalog.preferredVideoModel).toBe('grok-imagine-video')
    expect(catalog.preferredChatModel).toBe('grok-3-mini')
    expect(catalog.preferredVisionModel).toBe('grok-4.20-beta-latest-non-reasoning')
  })
})
