import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { sql } from 'drizzle-orm'

/**
 * Admin-only entity. `voip_campaigns` is CT-identity config managed via the
 * Resync + campaign-binding screen — no per-agent ownership. Agents never see
 * it via the scope path; super-admin bypasses scoping via the omni-path, so
 * this strict-default predicate means only omni queries succeed.
 *
 * see ../DOCS.md#admin-only-visibility
 */
export function voipCampaignVisibility(_scope: VisibilityScope): SQL {
  return sql`FALSE`
}
