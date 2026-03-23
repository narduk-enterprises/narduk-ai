import { and, eq, inArray, or, isNull, sql } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'
import { defineAdminMutation } from '#layer/server/utils/mutation'
import { isPresetElementType, normalizePresetElementState } from '#server/utils/promptElementData'

/**
 * POST /api/admin/backfill-attributes — Backfill or repair preset attributes JSON from content text.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'backfill-attributes', maxRequests: 5, windowMs: 60_000 },
  },
  async ({ event }) => {
    const log = useLogger(event).child('BackfillAttributes')
    const db = useAppDatabase(event)

    // Find preset elements missing or carrying invalid attributes JSON.
    const elements = await db
      .select({
        id: promptElements.id,
        type: promptElements.type,
        name: promptElements.name,
        content: promptElements.content,
        attributes: promptElements.attributes,
      })
      .from(promptElements)
      .where(
        and(
          inArray(promptElements.type, [
            'person',
            'scene',
            'framing',
            'action',
            'style',
            'clothing',
          ]),
          or(isNull(promptElements.attributes), sql`json_valid(${promptElements.attributes}) = 0`),
        ),
      )
      .all()

    if (elements.length === 0) {
      return { updated: 0, message: 'No elements need backfilling' }
    }

    let updated = 0
    const errors: string[] = []

    for (const el of elements) {
      try {
        if (!isPresetElementType(el.type)) continue

        const normalized = normalizePresetElementState({
          type: el.type,
          name: el.name,
          content: el.content,
          attributes: el.attributes,
        })

        if (!normalized.attributes) continue

        await db
          .update(promptElements)
          .set({
            content: normalized.content,
            attributes: normalized.attributes,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(promptElements.id, el.id))
        updated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`${el.id}: ${msg}`)
      }
    }

    log.info('Backfill complete', { total: elements.length, updated, errors: errors.length })

    return {
      total: elements.length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    }
  },
)
