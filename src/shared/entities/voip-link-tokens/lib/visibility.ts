import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { voipLinkTokens } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only link tokens they minted
 * (`created_by_user_id` matches the session user).
 *
 * Customer consumption uses the token itself (URL path param) via the
 * shareable middleware (`spec.shareable.tokenColumn = 'token'`), bypassing
 * this session-based predicate entirely.
 *
 * see ../DOCS.md#visibility-via-creator
 */
export function voipLinkTokenVisibility(userId: string): SQL {
  return eq(voipLinkTokens.createdByUserId, userId)
}
