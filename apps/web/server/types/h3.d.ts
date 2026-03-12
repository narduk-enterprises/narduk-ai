import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from '#server/database/schema'

declare module 'h3' {
  interface H3EventContext {
    /** Per-request Drizzle instance for the app schema, memoized by useAppDatabase(). */
    _appDb?: DrizzleD1Database<typeof schema>
  }
}
