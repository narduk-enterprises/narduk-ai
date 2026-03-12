const PRESET_ELEMENT_TYPES = ['person', 'scene', 'framing', 'action', 'style'] as const
const FALLBACK_PROMPT_ATTRIBUTE_KEY = 'prompt'

type PresetElementType = (typeof PRESET_ELEMENT_TYPES)[number]

interface PromptElementLike {
  type: string
  name: string
  content: string
  attributes: string | null
  metadata: string | null
  chatHistory: string | null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPresetElementType(type: string): type is PresetElementType {
  return PRESET_ELEMENT_TYPES.includes(type as PresetElementType)
}

export function parsePresetContent(content: string): Record<string, string> {
  const attrs: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim().toLowerCase().replaceAll(' ', '_')
    const value = line.slice(idx + 1).trim()

    if (key && value) {
      attrs[key] = value
    }
  }

  return attrs
}

export function parseAttributesJson(
  attributes: string | null | undefined,
): Record<string, string> | null {
  if (!attributes) return null

  try {
    const parsed = JSON.parse(attributes) as unknown
    if (!isObjectRecord(parsed)) return null

    const normalized: Record<string, string> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue

      const normalizedKey = key.trim()
      const normalizedValue = value.trim()

      if (normalizedKey && normalizedValue) {
        normalized[normalizedKey] = normalizedValue
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : null
  } catch {
    return null
  }
}

export function attributesToContent(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes).filter(([, value]) => value)
  const nonNameEntries = entries.filter(([key]) => key !== 'name')

  if (nonNameEntries.length === 1 && nonNameEntries[0]?.[0] === FALLBACK_PROMPT_ATTRIBUTE_KEY) {
    return nonNameEntries[0][1]
  }

  return entries
    .map(([key, value]) => {
      const normalizedValue = value.includes('\n')
        ? value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ')
        : value

      return `${key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ')}: ${normalizedValue}`
    })
    .join('\n')
}

export function normalizePresetElementState(input: {
  type: string
  name: string
  content: string
  attributes?: string | null
}) {
  if (!isPresetElementType(input.type)) {
    return {
      content: input.content,
      attributes: input.attributes ?? null,
    }
  }

  const parsedAttributes = parseAttributesJson(input.attributes)
  const derivedFromContent = parsePresetContent(input.content)
  const attributes = {
    ...derivedFromContent,
    ...(parsedAttributes ?? {}),
  }
  const trimmedContent = input.content.trim()

  if (Object.keys(attributes).length === 0) {
    if (!trimmedContent) {
      return {
        content: input.content,
        attributes: null,
      }
    }

    const fallbackAttributes = {
      name: input.name,
      [FALLBACK_PROMPT_ATTRIBUTE_KEY]: trimmedContent,
    }

    return {
      content: trimmedContent,
      attributes: JSON.stringify(fallbackAttributes),
    }
  }

  attributes.name = input.name

  return {
    content: attributesToContent(attributes),
    attributes: JSON.stringify(attributes),
  }
}

export function resolveAttributesInputForUpdate(input: {
  contentProvided: boolean
  attributes: string | null | undefined
  attributesProvided: boolean
  existingAttributes: string | null | undefined
}): string | null {
  if (input.attributesProvided) {
    return input.attributes ?? null
  }

  // When the user edits raw content directly, treat that content as the
  // source of truth instead of letting stale structured attributes rewrite it.
  if (input.contentProvided) {
    return null
  }

  return input.existingAttributes ?? null
}

function normalizeJsonBlob(
  raw: string | null | undefined,
  expectedShape: 'array' | 'object',
): string | null {
  if (raw == null) return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = JSON.parse(trimmed) as unknown

  if (expectedShape === 'array' && !Array.isArray(parsed)) {
    throw new Error('Expected a JSON array')
  }

  if (expectedShape === 'object' && !isObjectRecord(parsed)) {
    throw new Error('Expected a JSON object')
  }

  return JSON.stringify(parsed)
}

export function normalizeMetadataJson(raw: string | null | undefined): string | null {
  return normalizeJsonBlob(raw, 'object')
}

export function normalizeChatHistoryJson(raw: string | null | undefined): string | null {
  return normalizeJsonBlob(raw, 'array')
}

export function hydratePromptElementForRead<T extends PromptElementLike>(row: T): T {
  const normalizedPreset = normalizePresetElementState(row)

  return {
    ...row,
    content: normalizedPreset.content,
    attributes: normalizedPreset.attributes,
    metadata: (() => {
      try {
        return normalizeMetadataJson(row.metadata)
      } catch {
        return null
      }
    })(),
    chatHistory: (() => {
      try {
        return normalizeChatHistoryJson(row.chatHistory)
      } catch {
        return null
      }
    })(),
  }
}
