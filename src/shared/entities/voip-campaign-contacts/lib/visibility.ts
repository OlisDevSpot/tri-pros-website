import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/**
 * Admin-only entity (ring 1). Per-customer CloudTalk participation records are
 * an ops surface — enrolled-count badges + the disqualify action read through
 * the tRPC router under admin gating, not via scoped CRUD. Super-admin bypasses
 * scoping via the omni-path; this strict-default predicate means only omni
 * queries succeed via the scope path.
 *
 * (Ring 2+ may relax this to let agents see participation of their own
 * customers — that's a join through `customers` and out of ring-1 scope.)
 *
 * see ../DOCS.md#admin-only-visibility
 */
export function voipCampaignContactVisibility(_userId: string): SQL {
  return sql`FALSE`
}
