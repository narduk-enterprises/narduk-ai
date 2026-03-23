import { z } from 'zod'
import { grokChat, grokListModels } from '#server/utils/grok'
import { getSystemPrompt } from '#server/utils/systemPrompts'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import {
  MAX_ITERATION_CONTEXT_STEPS,
  MAX_ITERATION_PASS_COUNT,
  trimIterationContextSteps,
} from '~/utils/iterationConfig'
import { MAX_GENERATION_PROMPT_LENGTH } from '~/utils/promptLimits'
import { buildXaiModelCatalog, isVisionCapableChatModel } from '~/utils/xaiModels'

const priorStepSchema = z.object({
  iteration: z.number().int().min(1).max(MAX_ITERATION_PASS_COUNT),
  prompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  changeSummary: z.string().min(1).max(2_000),
  message: z.string().max(2_000).nullish(),
  renderedPrompt: z.string().max(MAX_GENERATION_PROMPT_LENGTH).nullish(),
  imageAnalysis: z.string().max(4_000).nullish(),
})

const bodySchema = z.object({
  renderedPrompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  goal: z.string().min(1).max(4_000),
  imageUrl: z.string().min(1).max(20_000_000),
  iteration: z.number().int().min(1).max(MAX_ITERATION_PASS_COUNT),
  totalIterations: z.number().int().min(1).max(MAX_ITERATION_PASS_COUNT),
  priorSteps: z.array(priorStepSchema).max(50).default([]),
  model: z.string().optional(),
})

const grokResponseSchema = z
  .object({
    revisedPrompt: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    changeSummary: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
    imageAnalysis: z.string().min(1).optional(),
    analysis: z.string().min(1).optional(),
  })
  .transform((value) => ({
    revisedPrompt: value.revisedPrompt || value.prompt || '',
    changeSummary: value.changeSummary || value.summary || value.message || '',
    message: value.message || null,
    imageAnalysis: value.imageAnalysis || value.analysis || '',
  }))

function buildIterationReviewContent(body: z.infer<typeof bodySchema>): string {
  const recentPriorSteps = trimIterationContextSteps(body.priorSteps)
  const priorSteps =
    recentPriorSteps.length > 0
      ? [
          ...(recentPriorSteps[0]!.iteration > 1
            ? [
                `Recent prior passes only. Earlier passes were omitted to keep the loop focused on the last ${Math.min(MAX_ITERATION_CONTEXT_STEPS, recentPriorSteps.length)} results.`,
              ]
            : []),
          ...recentPriorSteps.map((step) =>
            [
              `Pass ${step.iteration}`,
              `Summary: ${step.changeSummary}`,
              step.imageAnalysis ? `Image review: ${step.imageAnalysis}` : null,
              step.renderedPrompt ? `Rendered prompt:\n${step.renderedPrompt}` : null,
              `Next prompt:\n${step.prompt}`,
            ]
              .filter(Boolean)
              .join('\n'),
          ),
        ].join('\n\n')
      : 'None.'

  return [
    `Goal:\n${body.goal}`,
    `Current pass: ${body.iteration} of ${body.totalIterations}`,
    `Prompt used to render this image:\n${body.renderedPrompt}`,
    `Prior completed passes:\n${priorSteps}`,
    'Review the attached image against the goal, then return JSON only with the next prompt revision.',
  ].join('\n\n')
}

/**
 * POST /api/chat/iterate-review — Reviews one generated image and revises the next pass.
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'chat-iterate-review', maxRequests: 60, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const log = useLogger(event).child('ChatIterateReview')
    const config = useRuntimeConfig(event)

    if (!config.xaiApiKey) {
      throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
    }

    try {
      const systemPrompt = await getSystemPrompt(event, 'chat_iteration_review')
      let visionModel: string | null = body.model ?? null

      if (!visionModel || !isVisionCapableChatModel(visionModel)) {
        const catalog = buildXaiModelCatalog(
          (await grokListModels(config.xaiApiKey)).map((m) => m.id),
        )
        visionModel = catalog.preferredVisionModel
      }

      if (!visionModel) {
        throw createError({
          statusCode: 500,
          message: 'No vision-capable xAI model is available for iteration review.',
        })
      }

      const content = await grokChat(
        config.xaiApiKey,
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildIterationReviewContent(body) },
              { type: 'image_url', image_url: { url: body.imageUrl } },
            ],
          },
        ],
        visionModel,
        { type: 'json_object' },
      )

      const parsedJson = JSON.parse(content)
      const parsed = grokResponseSchema.parse(parsedJson)

      if (!parsed.revisedPrompt || !parsed.changeSummary || !parsed.imageAnalysis) {
        throw createError({
          statusCode: 500,
          message: 'Iteration review returned an incomplete response.',
        })
      }

      log.info('Iteration review completed', {
        userId: user.id,
        iteration: body.iteration,
        totalIterations: body.totalIterations,
        model: visionModel,
      })

      return parsed
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to run iteration image review'
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode) || 500
          : 500

      log.error('Iteration review failed', {
        userId: user.id,
        iteration: body.iteration,
        error: errorMessage,
      })

      throw createError({
        statusCode,
        message: errorMessage || 'Failed to run iteration image review',
      })
    }
  },
)
