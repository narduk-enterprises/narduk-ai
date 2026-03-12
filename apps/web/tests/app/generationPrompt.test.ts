import { describe, expect, it } from 'vitest'

import { getGenerationSharePrompt } from '../../app/utils/generationPrompt'

describe('generation prompt helpers', () => {
  it('prefers the saved user prompt from lineage when available', () => {
    expect(
      getGenerationSharePrompt({
        prompt: 'Name: Emma\nScene: Backyard party',
        lineage: JSON.stringify({
          userPrompt: 'A photorealistic portrait of Emma at a summer backyard party.',
        }),
      }),
    ).toBe('A photorealistic portrait of Emma at a summer backyard party.')
  })

  it('extracts the trailing freeform prompt from legacy structured prompts', () => {
    expect(
      getGenerationSharePrompt({
        prompt: `Person - Name: Emma Foster Update
Person - Description: Relatable Everyday Hottie
Scene - Name: Daytime Frat Frenzy
Action - Name: Wall Lean Pose
Style - Name: Cinematic Photorealism
A photorealistic, indistinguishable-from-real-life depiction of Emma Foster leaning casually against the house deck wall in a chaotic suburban backyard party at midday.`,
        lineage: null,
      }),
    ).toBe(
      'A photorealistic, indistinguishable-from-real-life depiction of Emma Foster leaning casually against the house deck wall in a chaotic suburban backyard party at midday.',
    )
  })

  it('falls back to the raw prompt when it is already plain text', () => {
    expect(
      getGenerationSharePrompt({
        prompt: 'Photorealistic golden-hour portrait shot on 35mm film.',
        lineage: null,
      }),
    ).toBe('Photorealistic golden-hour portrait shot on 35mm film.')
  })
})
