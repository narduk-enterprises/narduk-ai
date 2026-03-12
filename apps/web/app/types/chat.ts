export type ChatMode = 'general' | 'person' | 'scene' | 'framing' | 'action' | 'style'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface IterationStep {
  iteration: number
  prompt: string
  changeSummary: string
  message?: string | null
  renderedPrompt?: string | null
  imageUrl?: string | null
  imageAnalysis?: string | null
}

export interface IterationRun {
  goal: string
  initialPrompt: string
  currentPrompt: string
  status: 'running' | 'completed' | 'stopped' | 'failed'
  completedIterations: number
  totalIterations: number
  round: number
  steps: IterationStep[]
}

export interface ChatParsedResponse {
  message: string
  prompt: string | null
  suggested_name?: string | null
  continuation_summary?: string | null
  builder_state?: Record<string, string | null> | null
  imageUrl?: string | null
  isInlineGeneration?: boolean
  iterationRun?: IterationRun | null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
  parsedResponse?: ChatParsedResponse
}

export type ChatPersistenceMode = 'memory' | 'session'
