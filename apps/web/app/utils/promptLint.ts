/**
 * Prompt Lint — flags prompt patterns that degrade Grok Imagine (Aurora) output.
 *
 * Aurora ignores or inverts negative instructions. This linter detects
 * negative phrasing and suggests positive alternatives. It also flags
 * prompt length issues based on Aurora's effective limits.
 */

import { AURORA_MAX_EFFECTIVE_LENGTH, AURORA_OPTIMAL_LENGTH } from './promptLimits'

export type PromptWarningSeverity = 'info' | 'caution' | 'warning'

export interface PromptWarning {
  severity: PromptWarningSeverity
  message: string
  suggestion?: string
  position?: number
}

// ─── Negative Phrasing Patterns ──────────────────────────────

interface NegativePattern {
  regex: RegExp
  suggestion: string
}

const NEGATIVE_PATTERNS: NegativePattern[] = [
  { regex: /\bno blur\b/gi, suggestion: 'sharp focus, crisp detail' },
  { regex: /\bno noise\b/gi, suggestion: 'clean composition, smooth textures' },
  { regex: /\bno artifacts?\b/gi, suggestion: 'clean, polished rendering' },
  { regex: /\bno distort(?:ion|ed)?\b/gi, suggestion: 'accurate proportions, natural anatomy' },
  { regex: /\bno anime\b/gi, suggestion: 'photorealistic, shot on real camera' },
  { regex: /\bno cartoon\b/gi, suggestion: 'photorealistic, natural lighting' },
  { regex: /\bno cgi\b/gi, suggestion: 'photorealistic, real-world textures' },
  { regex: /\bno (?:3d|3-d) render\b/gi, suggestion: 'photorealistic, natural lighting' },
  { regex: /\bno text\b/gi, suggestion: 'clean background without lettering' },
  { regex: /\bno watermark\b/gi, suggestion: 'clean image, professional photograph' },
  {
    regex: /\bno extra (?:limbs?|fingers?|hands?)\b/gi,
    suggestion: 'anatomically correct, natural pose',
  },
  { regex: /\bwithout (?:blur|noise|grain)\b/gi, suggestion: 'sharp focus, clean composition' },
  {
    regex: /\bavoid (\w+)/gi,
    suggestion: 'use a positive description of what you DO want instead',
  },
  {
    regex: /\bdon'?t (?:include|add|show|make|use)\b/gi,
    suggestion: 'describe what you want to see, not what to avoid',
  },
  { regex: /\bnever (\w+)/gi, suggestion: 'describe the desired outcome positively' },
]

// ─── Main Lint Function ──────────────────────────────────────

/**
 * Lint a prompt for Aurora-hostile patterns.
 *
 * Returns an array of warnings with severity, message, and optional suggestions.
 * Empty array = clean prompt.
 */
export function lintPrompt(text: string): PromptWarning[] {
  const warnings: PromptWarning[] = []

  if (!text.trim()) return warnings

  // 1. Check negative phrasing
  for (const pattern of NEGATIVE_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.regex.lastIndex = 0
    let match: RegExpExecArray | null = pattern.regex.exec(text)
    while (match) {
      warnings.push({
        severity: 'warning',
        message: `Negative phrasing "${match[0]}" — Aurora may ignore or invert this`,
        suggestion: pattern.suggestion,
        position: match.index,
      })
      match = pattern.regex.exec(text)
    }
  }

  // 2. Generic "not" detection (catch-all, lower severity)
  const genericNotPattern = /\bnot\s+\w+/gi
  let notMatch: RegExpExecArray | null = genericNotPattern.exec(text)
  while (notMatch) {
    // Skip if already caught by specific patterns above
    const alreadyCovered = warnings.some(
      (w) =>
        w.position !== undefined &&
        notMatch!.index >= w.position &&
        notMatch!.index <= w.position + 20,
    )
    if (!alreadyCovered) {
      warnings.push({
        severity: 'info',
        message: `Negative phrasing "${notMatch[0]}" — consider rephrasing positively`,
        suggestion: 'Describe what you want to see instead of what to avoid',
        position: notMatch.index,
      })
    }
    notMatch = genericNotPattern.exec(text)
  }

  // 3. Length checks
  const len = text.length
  if (len > AURORA_MAX_EFFECTIVE_LENGTH) {
    warnings.push({
      severity: 'warning',
      message: `Prompt is ${len} characters — Aurora loses coherence above ${AURORA_MAX_EFFECTIVE_LENGTH}`,
      suggestion: 'Remove secondary details or descriptions to stay under 1,000 characters',
    })
  } else if (len > AURORA_OPTIMAL_LENGTH) {
    warnings.push({
      severity: 'caution',
      message: `Prompt is ${len} characters — Aurora works best under ${AURORA_OPTIMAL_LENGTH}`,
      suggestion: 'Consider condensing for optimal results',
    })
  }

  return warnings
}
