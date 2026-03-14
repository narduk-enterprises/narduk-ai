/// <reference types="@cloudflare/workers-types" />
import type { H3Event } from 'h3'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '#server/database/schema'

/**
 * Return a Drizzle ORM instance with the **app-level** schema.
 *
 * Works identically to the layer's `useDatabase()` but typed to the
 * app's extended schema (generations, imageComparisons, etc.).
 * Memoized on `event.context` to avoid redundant instantiation.
 */
export function useAppDatabase(event: H3Event): DrizzleD1Database<typeof schema> {
  if (event.context._appDb) {
    return event.context._appDb
  }

  const d1 = (event.context.cloudflare?.env as { DB?: D1Database })?.DB
  if (!d1) {
    throw createError({
      statusCode: 500,
      message: 'D1 database binding not available. Ensure DB is configured in wrangler.json.',
    })
  }

  const db = drizzle(d1, { schema })
  event.context._appDb = db
  return db
}
