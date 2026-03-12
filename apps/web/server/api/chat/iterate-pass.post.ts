import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { appSettings } from '#server/database/schema'
import { useAppDatabase } from '#server/utils/database'
import { grokChat, grokGenerateImage, grokListModels } from '#server/utils/grok'
import { persistGeneratedImage } from '#server/utils/persistGeneratedImage'
import { getSystemPrompt } from '#server/utils/systemPrompts'
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
  contextSnapshot: z.string().max(8_000).nullish(),
  renderedPrompt: z.string().max(MAX_GENERATION_PROMPT_LENGTH).nullish(),
  imageAnalysis: z.string().max(4_000).nullish(),
})

const bodySchema = z.object({
  prompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
  goal: z.string().min(1).max(4_000),
  context: z.string().max(8_000).optional().default(''),
  iteration: z.number().int().min(1).max(MAX_ITERATION_PASS_COUNT),
  totalIterations: z.number().int().min(1).max(MAX_ITERATION_PASS_COUNT),
  priorSteps: z.array(priorStepSchema).max(50).default([]),
  model: z.string().optional(),
  visionModel: z.string().optional(),
  imageModel: z.string().optional(),
})

const iterationStepResponseSchema = z
  .object({
    revisedPrompt: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    changeSummary: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  })
  .transform((value) => ({
    revisedPrompt: value.revisedPrompt || value.prompt || '',
    changeSummary: value.changeSummary || value.summary || value.message || '',
    message: value.message || null,
  }))

const iterationReviewResponseSchema = z
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

function buildPriorStepsSummary(body: z.infer<typeof bodySchema>): string {
  const recentPriorSteps = trimIterationContextSteps(body.priorSteps)

  if (recentPriorSteps.length === 0) {
    return 'None.'
  }

  const summarySections = recentPriorSteps.map((step) =>
    [
      `Pass ${step.iteration}`,
      `Summary: ${step.changeSummary}`,
      step.contextSnapshot ? `User context:\n${step.contextSnapshot}` : null,
      step.imageAnalysis ? `Image review: ${step.imageAnalysis}` : null,
      step.renderedPrompt ? `Rendered prompt:\n${step.renderedPrompt}` : null,
      `Next prompt:\n${step.prompt}`,
    ]
      .filter(Boolean)
      .join('\n'),
  )

  if (recentPriorSteps[0]!.iteration === 1) {
    return summarySections.join('\n\n')
  }

  return [
    `Recent prior passes only. Earlier passes were omitted to keep the loop focused on the last ${Math.min(MAX_ITERATION_CONTEXT_STEPS, recentPriorSteps.length)} results.`,
    ...summarySections,
  ].join('\n\n')
}

function buildIterationStepUserContent(body: z.infer<typeof bodySchema>): string {
  return [
    `Goal:\n${body.goal}`,
    body.context.trim() ? `User context:\n${body.context.trim()}` : null,
    `Current pass: ${body.iteration} of ${body.totalIterations}`,
    `Current prompt:\n${body.prompt}`,
    `Prior completed passes:\n${buildPriorStepsSummary(body)}`,
    'Improve the prompt by one pass and return JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildIterationReviewUserContent(
  body: z.infer<typeof bodySchema>,
  renderedPrompt: string,
): string {
  return [
    `Goal:\n${body.goal}`,
    body.context.trim() ? `User context:\n${body.context.trim()}` : null,
    `Current pass: ${body.iteration} of ${body.totalIterations}`,
    `Prompt used to render this image:\n${renderedPrompt}`,
    `Prior completed passes:\n${buildPriorStepsSummary(body)}`,
    'Review the attached image against the goal, then return JSON only with the next prompt revision.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * POST /api/chat/iterate-pass — Runs one full iteration pass:
 * prompt rewrite -> draft image render -> vision review -> next prompt.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event).child('ChatIteratePass')
  const user = await requireAuth(event)
  await enforceRateLimit(event, 'chat-iterate-pass', 60, 60_000)
  const body = await readValidatedBody(event, bodySchema.parse)
  const config = useRuntimeConfig(event)

  if (!config.xaiApiKey) {
    throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
  }

  const db = useAppDatabase(event)
  let chatModel = body.model || 'grok-3-mini'
  let imageModel = body.imageModel || 'grok-imagine-image'

  if (!body.model || !body.imageModel) {
    try {
      const settings = await db
        .select({
          promptEnhanceModel: appSettings.promptEnhanceModel,
          imageModel: appSettings.imageModel,
        })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
        .get()

      if (!body.model && settings?.promptEnhanceModel) {
        chatModel = settings.promptEnhanceModel
      }

      if (!body.imageModel && settings?.imageModel) {
        imageModel = settings.imageModel
      }
    } catch (error) {
      log.warn('Could not fetch appSettings for iterate-pass models', { error })
    }
  }

  try {
    const stepSystemPrompt = await getSystemPrompt(event, 'chat_iteration_step')
    const reviewSystemPrompt = await getSystemPrompt(event, 'chat_iteration_review')

    let visionModel: string | null =
      body.visionModel || (isVisionCapableChatModel(chatModel) ? chatModel : null)

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

    const stepContent = await grokChat(
      config.xaiApiKey,
      [
        { role: 'system', content: stepSystemPrompt },
        { role: 'user', content: buildIterationStepUserContent(body) },
      ],
      chatModel,
      { type: 'json_object' },
    )

    const step = iterationStepResponseSchema.parse(JSON.parse(stepContent))
    if (!step.revisedPrompt || !step.changeSummary) {
      throw createError({
        statusCode: 500,
        message: 'Iteration step returned an incomplete response.',
      })
    }

    const renderStartTimeMs = Date.now()
    const generatedImage = await grokGenerateImage(config.xaiApiKey, {
      prompt: step.revisedPrompt,
      model: imageModel,
    })
    const generationTimeMs = Date.now() - renderStartTimeMs

    const draftImageUrl = generatedImage.data?.[0]?.url
    if (!draftImageUrl) {
      throw createError({ statusCode: 502, message: 'No image returned from Grok API' })
    }

    const reviewContent = await grokChat(
      config.xaiApiKey,
      [
        { role: 'system', content: reviewSystemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildIterationReviewUserContent(body, step.revisedPrompt),
            },
            { type: 'image_url', image_url: { url: draftImageUrl } },
          ],
        },
      ],
      visionModel,
      { type: 'json_object' },
    )

    const review = iterationReviewResponseSchema.parse(JSON.parse(reviewContent))
    if (!review.revisedPrompt || !review.changeSummary || !review.imageAnalysis) {
      throw createError({
        statusCode: 500,
        message: 'Iteration review returned an incomplete response.',
      })
    }

    const savedGeneration = await persistGeneratedImage(event, {
      userId: user.id,
      prompt: step.revisedPrompt,
      mode: 't2i',
      remoteImageUrl: draftImageUrl,
      generationTimeMs,
      metadata: {
        revised_prompt: generatedImage.data?.[0]?.revised_prompt ?? null,
        iteration: {
          pass: body.iteration,
          totalIterations: body.totalIterations,
          goal: body.goal,
          context: body.context.trim() || null,
          review: review.imageAnalysis,
          nextPrompt: review.revisedPrompt,
          renderedPrompt: step.revisedPrompt,
        },
      },
      failureMessage: 'Failed to save iteration image',
    })

    log.info('Iteration pass completed', {
      userId: user.id,
      iteration: body.iteration,
      totalIterations: body.totalIterations,
      chatModel,
      visionModel,
      imageModel,
      generationTimeMs,
      generationId: savedGeneration.id,
    })

    return {
      revisedPrompt: review.revisedPrompt,
      changeSummary: review.changeSummary,
      message: review.message || step.message || null,
      contextSnapshot: body.context.trim() || null,
      renderedPrompt: step.revisedPrompt,
      imageUrl: savedGeneration.mediaUrl,
      generationId: savedGeneration.id,
      imageAnalysis: review.imageAnalysis,
      generationTimeMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to run iteration pass'
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500

    log.error('Iteration pass failed', {
      userId: user.id,
      iteration: body.iteration,
      error: errorMessage,
    })

    throw createError({
      statusCode,
      message: errorMessage || 'Failed to run iteration pass',
    })
  }
})
