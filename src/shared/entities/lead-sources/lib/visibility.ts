import type { SQL } from 'drizzle-orm'

import type { VisibilityScope } from '@/shared/dal/server/types'

import { sql } from 'drizzle-orm'

/**
 * Lead sources are a super-admin-only entity: the only router surface is
 * `superAdminProcedure`, whose callers resolve to omni (`scope: null`) and
 * bypass this predicate entirely. A non-omni actor should see NO lead sources,
 * so deny by default — `sql\`false\`` yields an empty result set rather than
 * leaking rows. If lead sources ever gain a non-omni surface, replace this with
 * a real ownership fragment.
 */
export function leadSourceVisibility(_scope: VisibilityScope): SQL {
  return sql`false`
}
