import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { eq } from 'drizzle-orm'
import { appSettings, quickModifiers } from '#server/database/schema'
import { xaiImagineChat } from '#server/utils/grok'
import { MAX_GENERATION_PROMPT_LENGTH } from '~/utils/promptLimits'

const bodySchema = z.object({
  prompt: z.string().min(1).max(MAX_GENERATION_PROMPT_LENGTH),
})

/**
 * POST /api/generate/parse-prompt — Parse a raw prompt into structured presets + modifiers.
 * Returns: { type, attributes, matchedModifierIds, remainingPrompt }
 */
export default defineUserMutation(
  {
    rateLimit: { namespace: 'parse-prompt', maxRequests: 20, windowMs: 60_000 },
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const log = useLogger(event).child('ParsePrompt')
    const config = useRuntimeConfig(event)

    if (!config.xaiApiKey) {
      throw createError({ statusCode: 500, message: 'GROK_API_KEY not configured' })
    }

    const db = useDatabase(event)

    // Fetch configured model
    let chatModel = 'grok-3-mini'
    try {
      const settings = await db
        .select({ promptEnhanceModel: appSettings.promptEnhanceModel })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
        .get()
      if (settings?.promptEnhanceModel) {
        chatModel = settings.promptEnhanceModel
      }
    } catch (err) {
      log.warn('Could not fetch appSettings for chatModel', { err })
    }

    // Fetch available Quick Modifiers
    const modifiers = await db
      .select({
        id: quickModifiers.id,
        category: quickModifiers.category,
        label: quickModifiers.label,
        snippet: quickModifiers.snippet,
      })
      .from(quickModifiers)
      .all()

    const modifierList = modifiers
      .map(
        (m) =>
          `- ID: ${m.id} | Category: ${m.category} | Label: ${m.label} | Snippet: ${m.snippet}`,
      )
      .join('\n')

    // Use shared schema context from server util
    const schemas = serverSchemaContext()

    const systemPrompt = `You are an expert prompt analyst for AI image and video generation.
Given a raw generation prompt, decompose it into structured components.

AVAILABLE PRESET ATTRIBUTE SCHEMAS:
${schemas}

AVAILABLE QUICK MODIFIERS:
${modifierList}

INSTRUCTIONS:
1. Determine which preset type best matches the prompt (person, scene, framing, action, style, clothing, or "mixed" if multiple)
2. Extract attribute values that match the schema fields for that type
3. Identify Quick Modifier IDs whose snippets or labels match aspects of the prompt
4. Put any remaining text that doesn't fit into attributes into "remainingPrompt"

Return ONLY valid JSON (no markdown, no code fences):
{
  "type": "person|scene|framing|action|style|clothing|mixed",
  "attributes": { "key": "value" },
  "matchedModifierIds": ["id1", "id2"],
  "remainingPrompt": "text not captured by attributes"
}`

    try {
      const responseContent = await xaiImagineChat(
        config.xaiApiKey,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse this prompt:\n\n${body.prompt}` },
        ],
        chatModel,
        { type: 'json_object' },
      )

      log.info('Prompt parsed successfully', { userId: user.id })

      // Parse the JSON response
      try {
        const parsed = JSON.parse(responseContent)
        return {
          type: parsed.type || 'mixed',
          attributes: parsed.attributes || {},
          matchedModifierIds: parsed.matchedModifierIds || [],
          remainingPrompt: parsed.remainingPrompt || '',
        }
      } catch {
        log.error('Failed to parse LLM JSON response', { response: responseContent })
        throw createError({ statusCode: 500, message: 'Failed to parse prompt analysis response' })
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err) throw err
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      log.error('Prompt parsing failed', { userId: user.id, error: errorMsg })
      throw createError({
        statusCode: 500,
        message: errorMsg || 'Failed to parse prompt',
      })
    }
  },
)
