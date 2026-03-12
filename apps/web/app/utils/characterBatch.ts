import { z } from 'zod'

const optionalTrimmedString = z.string().trim().min(1).optional()

const characterTemplateSchema = z.object({
  identity: z.object({
    character_id: z.string().trim().min(1),
    age_range: z.string().trim().min(1),
    gender: z.string().trim().min(1),
    ethnicity: optionalTrimmedString,
    skin_tone: optionalTrimmedString,
  }),
  appearance: z.object({
    face_shape: z.string().trim().min(1),
    eyes: z.object({
      shape: optionalTrimmedString,
      color: optionalTrimmedString,
      spacing: optionalTrimmedString,
    }),
    nose: z.object({
      type: optionalTrimmedString,
      tip: optionalTrimmedString,
    }),
    lips: z.object({
      upper: optionalTrimmedString,
      lower: optionalTrimmedString,
    }),
    hair: z.object({
      color: optionalTrimmedString,
      length: optionalTrimmedString,
      texture: optionalTrimmedString,
      part: optionalTrimmedString,
    }),
    distinct_features: z.array(z.string().trim().min(1)).optional(),
  }),
  baseline_expression: z.string().trim().min(1),
  body: z.object({
    height: optionalTrimmedString,
    build: optionalTrimmedString,
  }),
  scene: z.object({
    location: z.string().trim().min(1),
    action: z.string().trim().min(1),
    wardrobe: optionalTrimmedString,
    camera: z.object({
      framing: optionalTrimmedString,
      lens: optionalTrimmedString,
      angle: optionalTrimmedString,
    }),
    lighting: optionalTrimmedString,
  }),
  negative_prompt: z.array(z.string().trim().min(1)).optional(),
  config_overrides: z
    .object({
      n_baseline: z.number().int().min(1).max(10).optional(),
      n_angles: z.number().int().min(1).max(10).optional(),
      n_scenes: z.number().int().min(1).max(10).optional(),
      model: optionalTrimmedString,
    })
    .strict()
    .optional(),
})

export const characterInputFileSchema = z.object({
  characters: z.array(characterTemplateSchema).min(1),
})

export type CharacterTemplate = z.infer<typeof characterTemplateSchema>
export type CharacterInputFile = z.infer<typeof characterInputFileSchema>

const curatedPromptTemplateSchema = z.object({
  category: z.string().trim().min(1),
  label: z.string().trim().min(1),
  prompt_id: z.string().trim().min(1),
  prompt_text: z.string().trim().min(1),
})

export const curatedPromptBatchSchema = z.array(curatedPromptTemplateSchema).min(1)

export type CuratedPromptTemplate = z.infer<typeof curatedPromptTemplateSchema>
export type CuratedPromptBatch = z.infer<typeof curatedPromptBatchSchema>
export type CharacterBatchImportInput = CharacterInputFile | CuratedPromptBatch
export type CharacterBatchVariant = 'baseline' | 'angles' | 'scene' | 'imported_prompt'

export interface CharacterBatchRequest {
  customId: string
  characterId: string
  variant: CharacterBatchVariant
  variantIndex: number
  prompt: string
  requestedModel: string | null
}

export interface CharacterBatchSubmission {
  batchId: string
  inputFileId: string
  status:
    | 'validating'
    | 'failed'
    | 'in_progress'
    | 'finalizing'
    | 'completed'
    | 'expired'
    | 'cancelling'
    | 'cancelled'
  characterCount: number
  requestCount: number
  submittedAt: string
  previewPrompt: string
  requestPreview: Array<{
    customId: string
    characterId: string
    variant: CharacterBatchVariant
    variantIndex: number
  }>
}

const VARIANT_LABELS: Record<CharacterBatchVariant, string> = {
  baseline: 'Baseline',
  angles: 'Angle',
  scene: 'Scene',
  imported_prompt: 'Imported Prompt',
}

function compact(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value))
}

function toSentence(parts: Array<string | undefined>): string {
  return compact(parts).join(', ')
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function getRequestCount(
  character: CharacterTemplate,
  key: 'n_baseline' | 'n_angles' | 'n_scenes',
  fallback: number,
): number {
  const value = character.config_overrides?.[key]
  return typeof value === 'number' ? value : fallback
}

function buildSharedCharacterDescription(character: CharacterTemplate): string[] {
  const identity = toSentence([
    `age ${character.identity.age_range}`,
    character.identity.gender,
    character.identity.ethnicity,
    character.identity.skin_tone ? `skin tone ${character.identity.skin_tone}` : undefined,
  ])

  const eyes = toSentence([
    character.appearance.eyes.shape,
    character.appearance.eyes.color ? `${character.appearance.eyes.color} eyes` : undefined,
    character.appearance.eyes.spacing
      ? `${character.appearance.eyes.spacing} eye spacing`
      : undefined,
  ])

  const nose = toSentence([
    character.appearance.nose.type,
    character.appearance.nose.tip ? `${character.appearance.nose.tip} nose tip` : undefined,
  ])

  const lips = toSentence([
    character.appearance.lips.upper ? `upper lip ${character.appearance.lips.upper}` : undefined,
    character.appearance.lips.lower ? `lower lip ${character.appearance.lips.lower}` : undefined,
  ])

  const hair = toSentence([
    character.appearance.hair.color ? `${character.appearance.hair.color} hair` : undefined,
    character.appearance.hair.length,
    character.appearance.hair.texture,
    character.appearance.hair.part ? `${character.appearance.hair.part} part` : undefined,
  ])

  const distinctFeatures = character.appearance.distinct_features?.join(', ')
  const body = toSentence([
    character.body.height,
    character.body.build ? `${character.body.build} build` : undefined,
  ])

  const camera = toSentence([
    character.scene.camera.framing,
    character.scene.camera.lens ? `${character.scene.camera.lens} lens` : undefined,
    character.scene.camera.angle ? `${character.scene.camera.angle} angle` : undefined,
  ])

  return compact([
    `Create a photorealistic character image with strict identity consistency for character ${character.identity.character_id}.`,
    identity ? `Identity: ${identity}.` : undefined,
    `Face shape: ${character.appearance.face_shape}.`,
    eyes ? `Eyes: ${eyes}.` : undefined,
    nose ? `Nose: ${nose}.` : undefined,
    lips ? `Lips: ${lips}.` : undefined,
    hair ? `Hair: ${hair}.` : undefined,
    distinctFeatures ? `Distinct features: ${distinctFeatures}.` : undefined,
    `Baseline expression: ${character.baseline_expression}.`,
    body ? `Body: ${body}.` : undefined,
    `Location: ${character.scene.location}.`,
    `Action: ${character.scene.action}.`,
    character.scene.wardrobe ? `Wardrobe: ${character.scene.wardrobe}.` : undefined,
    camera ? `Camera: ${camera}.` : undefined,
    character.scene.lighting ? `Lighting: ${character.scene.lighting}.` : undefined,
  ])
}

function buildVariantInstruction(
  character: CharacterTemplate,
  variant: CharacterBatchVariant,
  variantIndex: number,
): string {
  if (variant === 'baseline') {
    return compact([
      'Render a clean baseline character reference image.',
      'Keep the look grounded, natural, and highly realistic.',
      variantIndex > 0 ? `This is baseline variation ${variantIndex + 1}.` : undefined,
    ]).join(' ')
  }

  if (variant === 'angles') {
    return compact([
      'Render an alternate-angle character reference image.',
      'Change the camera angle or framing while preserving the exact same identity, wardrobe, and setting.',
      `This is angle variation ${variantIndex + 1}.`,
    ]).join(' ')
  }

  return compact([
    'Render a full-scene storytelling image.',
    'Preserve the same character identity while emphasizing the location, action, wardrobe, and lighting.',
    `This is scene variation ${variantIndex + 1}.`,
  ]).join(' ')
}

export function buildCharacterPrompt(
  character: CharacterTemplate,
  variant: CharacterBatchVariant,
  variantIndex: number,
): string {
  const negativePrompt = character.negative_prompt?.join(', ')

  return compact([
    ...buildSharedCharacterDescription(character),
    buildVariantInstruction(character, variant, variantIndex),
    negativePrompt ? `Avoid: ${negativePrompt}.` : undefined,
  ]).join('\n')
}

export function buildCharacterBatchRequests(
  input: CharacterBatchImportInput,
): CharacterBatchRequest[] {
  if (Array.isArray(input)) {
    return input.map((entry, index) => ({
      customId: `imported-prompt-${index + 1}-${sanitizeId(entry.prompt_id || entry.label || `prompt-${index + 1}`)}`,
      characterId: entry.label,
      variant: 'imported_prompt',
      variantIndex: 1,
      prompt: entry.prompt_text,
      requestedModel: null,
    }))
  }

  return input.characters.flatMap((character, characterIndex) => {
    const requestModels = character.config_overrides?.model || null
    const requests: CharacterBatchRequest[] = []
    const characterSlug =
      sanitizeId(character.identity.character_id) || `character-${characterIndex + 1}`

    const pushVariant = (variant: CharacterBatchVariant, count: number) => {
      for (let index = 0; index < count; index++) {
        requests.push({
          customId: `character-${characterIndex + 1}-${characterSlug}-${variant}-${index + 1}`,
          characterId: character.identity.character_id,
          variant,
          variantIndex: index + 1,
          prompt: buildCharacterPrompt(character, variant, index),
          requestedModel: requestModels,
        })
      }
    }

    pushVariant('baseline', getRequestCount(character, 'n_baseline', 1))
    pushVariant('angles', getRequestCount(character, 'n_angles', 0))
    pushVariant('scene', getRequestCount(character, 'n_scenes', 0))

    return requests
  })
}

export function buildCharacterBatchPreviewPrompt(
  input: CharacterBatchImportInput,
  maxPreviewRequests = 3,
): string {
  const requests = buildCharacterBatchRequests(input)
  const preview = requests.slice(0, maxPreviewRequests)
  const summary = Array.isArray(input)
    ? `[JSON import test] ${input.length} imported prompt${input.length === 1 ? '' : 's'}, ${requests.length} batch request(s).`
    : `[JSON import test] ${input.characters.length} character(s), ${requests.length} batch request(s).`

  const sections = [
    summary,
    'The Generate button will submit these prompts through the OpenAI Batch API.',
    ...preview.map((request) => {
      const label = `${request.characterId} • ${VARIANT_LABELS[request.variant]} ${request.variantIndex}`
      return `${label}\n${truncate(request.prompt.replaceAll(/\s+/g, ' '), 360)}`
    }),
  ]

  if (requests.length > preview.length) {
    sections.push(`...and ${requests.length - preview.length} more request(s).`)
  }

  return sections.join('\n\n')
}

export function mapAspectRatioToOpenAIImageSize(
  aspectRatio?: string | null,
): '1024x1024' | '1024x1536' | '1536x1024' | 'auto' {
  if (!aspectRatio) return 'auto'

  if (aspectRatio === '1:1') return '1024x1024'
  if (['9:16', '3:4', '2:3'].includes(aspectRatio)) return '1024x1536'
  if (['16:9', '4:3', '3:2'].includes(aspectRatio)) return '1536x1024'

  return 'auto'
}

export function parseCharacterBatchImportInput(value: unknown): CharacterBatchImportInput {
  const structuredResult = characterInputFileSchema.safeParse(value)
  if (structuredResult.success) return structuredResult.data

  const curatedPromptResult = curatedPromptBatchSchema.safeParse(value)
  if (curatedPromptResult.success) return curatedPromptResult.data

  throw structuredResult.error
}

export function parseCharacterInputJson(rawJson: string): CharacterBatchImportInput {
  const parsed = JSON.parse(rawJson) as unknown
  return parseCharacterBatchImportInput(parsed)
}

export function getCharacterInputParseErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return 'Invalid JSON. Check for trailing commas or missing quotes.'
  }

  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0]
    if (!firstIssue) return 'The imported JSON did not match the expected schema.'
    const path = firstIssue.path.length ? firstIssue.path.join('.') : 'input'
    return `${path}: ${firstIssue.message}`
  }

  return error instanceof Error ? error.message : 'Failed to parse the imported JSON.'
}
