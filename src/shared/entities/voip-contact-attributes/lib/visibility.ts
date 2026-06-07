import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/**
 * Admin-only entity. `voip_contact_attributes` is CT-identity config (the
 * attribute-id ↔ app-key bridge) managed via Resync — no per-agent ownership.
 * Super-admin bypasses scoping via the omni-path; this strict-default predicate
 * means only omni queries succeed via the scope path.
 *
 * see ../DOCS.md#admin-only-visibility
 */
export function voipContactAttributeVisibility(_userId: string): SQL {
  return sql`FALSE`
}
