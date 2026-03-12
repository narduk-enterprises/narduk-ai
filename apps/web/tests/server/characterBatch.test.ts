import { describe, expect, it } from 'vitest'
import {
  buildCharacterBatchPreviewPrompt,
  buildCharacterBatchRequests,
  getCharacterInputParseErrorMessage,
  mapAspectRatioToOpenAIImageSize,
  parseCharacterInputJson,
} from '../../app/utils/characterBatch'

const sampleJson = JSON.stringify({
  characters: [
    {
      identity: {
        character_id: 'ava-stone',
        age_range: '26-30',
        gender: 'woman',
        ethnicity: 'mixed ethnicity',
        skin_tone: 'warm olive',
      },
      appearance: {
        face_shape: 'oval',
        eyes: {
          shape: 'almond',
          color: 'hazel',
          spacing: 'slightly wide',
        },
        nose: {
          type: 'straight',
          tip: 'soft rounded',
        },
        lips: {
          upper: 'defined',
          lower: 'full',
        },
        hair: {
          color: 'dark brown',
          length: 'shoulder length',
          texture: 'wavy',
          part: 'center',
        },
        distinct_features: ['freckles', 'small scar over left eyebrow'],
      },
      baseline_expression: 'calm, confident half-smile',
      body: {
        height: '5\'8"',
        build: 'athletic',
      },
      scene: {
        location: 'sunlit downtown street',
        action: 'walking toward camera',
        wardrobe: 'tailored charcoal coat over cream knitwear',
        camera: {
          framing: 'medium full shot',
          lens: '50mm',
          angle: 'eye level',
        },
        lighting: 'soft golden-hour daylight',
      },
      negative_prompt: ['blurry', 'extra fingers'],
      config_overrides: {
        n_baseline: 2,
        n_angles: 1,
        n_scenes: 1,
        model: 'gpt-image-1',
      },
    },
  ],
})

const importedPromptArrayJson = JSON.stringify([
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
])

describe('character batch utility', () => {
  it('parses the schema and expands override counts into batch requests', () => {
    const parsed = parseCharacterInputJson(sampleJson)
    const requests = buildCharacterBatchRequests(parsed)

    expect(parsed.characters).toHaveLength(1)
    expect(requests).toHaveLength(4)
    expect(requests.map((request) => request.variant)).toEqual([
      'baseline',
      'baseline',
      'angles',
      'scene',
    ])
    expect(requests.every((request) => request.requestedModel === 'gpt-image-1')).toBe(true)
    expect(requests[0]?.prompt).toContain('Create a photorealistic character image')
    expect(requests[0]?.prompt).toContain('Avoid: blurry, extra fingers.')
  })

  it('builds a concise preview prompt and maps supported aspect ratios', () => {
    const parsed = parseCharacterInputJson(sampleJson)
    const preview = buildCharacterBatchPreviewPrompt(parsed, 2)

    expect(preview).toContain('[JSON import test] 1 character(s), 4 batch request(s).')
    expect(preview).toContain(
      'The Generate button will submit these prompts through the OpenAI Batch API.',
    )
    expect(preview).toContain('...and 2 more request(s).')
    expect(mapAspectRatioToOpenAIImageSize('9:16')).toBe('1024x1536')
    expect(mapAspectRatioToOpenAIImageSize('16:9')).toBe('1536x1024')
    expect(mapAspectRatioToOpenAIImageSize('1:1')).toBe('1024x1024')
  })

  it('accepts imported prompt arrays and preserves their prompt text', () => {
    const parsed = parseCharacterInputJson(importedPromptArrayJson)
    const requests = buildCharacterBatchRequests(parsed)
    const preview = buildCharacterBatchPreviewPrompt(parsed)

    expect(Array.isArray(parsed)).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      characterId: 'full_smile',
      variant: 'imported_prompt',
      prompt: 'Photorealistic test prompt one',
    })
    expect(preview).toContain('[JSON import test] 2 imported prompts, 2 batch request(s).')
  })

  it('returns a friendly error for invalid JSON payloads', () => {
    const error = getCharacterInputParseErrorMessage(new SyntaxError('Unexpected token'))
    expect(error).toBe('Invalid JSON. Check for trailing commas or missing quotes.')
  })
})
