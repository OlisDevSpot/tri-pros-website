import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'
import { voipLinkTokens } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only link tokens they minted
 * (`created_by_user_id` matches the session user).
 */
export function voipLinkTokenVisibility({ userId }: VisibilityScope): SQL {
  return eq(voipLinkTokens.createdByUserId, userId)
}
