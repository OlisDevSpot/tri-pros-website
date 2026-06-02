import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/**
 * Admin-only entity. No agent ever sees app-settings via the scope path —
 * config is super-admin-only. Super-admin bypasses scoping via the omni-path,
 * so this predicate is the strict default and only super-admin queries succeed.
 *
 * see ../DOCS.md#admin-only-visibility
 */
export function appSettingVisibility(_userId: string): SQL {
  return sql`FALSE`
}
