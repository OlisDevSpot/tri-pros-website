import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { voipDids } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only DIDs assigned to them
 * (`assigned_user_id` matches the session user). Shared/inbound-only DIDs
 * (assigned_user_id = NULL) are invisible to agents — admin manages those.
 *
 * Super-admin queries bypass this via the omni-scope path.
 * see ../DOCS.md#visibility-via-assignment
 */
export function voipDidVisibility(userId: string): SQL {
  return eq(voipDids.assignedUserId, userId)
}
