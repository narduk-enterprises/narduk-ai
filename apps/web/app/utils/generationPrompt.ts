import type { Generation } from '~/types/generation'

interface GenerationLineagePayload {
  userPrompt?: unknown
}

const STRUCTURED_PROMPT_LINE_PATTERN =
  /^[a-z][a-z0-9 /()'",.&-]*(?:\s-\s[a-z][a-z0-9 /()'",.&-]*)?:\s+\S/i

function normalizePrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseLineage(lineage: string | null | undefined): GenerationLineagePayload | null {
  if (!lineage) return null

  try {
    const parsed = JSON.parse(lineage) as GenerationLineagePayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function inferTrailingFreeformPrompt(prompt: string): string | null {
  const lines = prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return null

  const trailingLines: string[] = []

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]!
    if (STRUCTURED_PROMPT_LINE_PATTERN.test(line)) {
      break
    }

    trailingLines.unshift(line)
  }

  if (!trailingLines.length || trailingLines.length === lines.length) {
    return null
  }

  const structuredPrefix = lines
    .slice(0, lines.length - trailingLines.length)
    .some((line) => STRUCTURED_PROMPT_LINE_PATTERN.test(line))

  if (!structuredPrefix) return null

  return trailingLines.join('\n')
}

export function getGenerationSharePrompt(
  generation: Pick<Generation, 'prompt' | 'lineage'>,
): string {
  const lineageUserPrompt = normalizePrompt(parseLineage(generation.lineage)?.userPrompt)
  if (lineageUserPrompt) return lineageUserPrompt

  const normalizedPrompt = normalizePrompt(generation.prompt)
  if (!normalizedPrompt) return ''

  return inferTrailingFreeformPrompt(normalizedPrompt) ?? normalizedPrompt
}
