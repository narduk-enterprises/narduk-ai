// Keep prompt limits aligned across compose, parse, save, and generate flows.
export const MAX_GENERATION_PROMPT_LENGTH = 20_000
export const MAX_SAVED_PROMPT_LENGTH = MAX_GENERATION_PROMPT_LENGTH
export const MAX_PROMPT_ELEMENT_CONTENT_LENGTH = 100_000

// Aurora-specific thresholds — image coherence degrades above these limits.
// The prose compiler uses these for length budgeting and warnings.
export const AURORA_OPTIMAL_LENGTH = 800
export const AURORA_MAX_EFFECTIVE_LENGTH = 1_000
