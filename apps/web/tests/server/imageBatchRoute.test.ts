import { describe, expect, it } from 'vitest'
import {
  buildCharacterBatchRequests,
  parseCharacterInputJson,
} from '../../app/utils/characterBatch'

describe('imported prompt arrays', () => {
  it('expand into one xAI image request per imported prompt', () => {
    const parsed = parseCharacterInputJson(
      JSON.stringify([
        {
          category: 'platform_curated',
          label: 'full_smile',
          prompt_id: '4af41aa1-781d-437d-99aa-54654f786ebb',
          prompt_text: 'Photorealistic test prompt one',
        },
        {
          category: 'platform_curated',
          label: 'scene_city_sidewalk',
          prompt_id: '7b83125c-ce41-43fc-99dc-f8f6769ef76e',
          prompt_text: 'Photorealistic test prompt two',
        },
      ]),
    )

    const requests = buildCharacterBatchRequests(parsed)

    expect(requests).toHaveLength(2)
    expect(requests[0]?.prompt).toBe('Photorealistic test prompt one')
    expect(requests[1]?.prompt).toBe('Photorealistic test prompt two')
  })
})
