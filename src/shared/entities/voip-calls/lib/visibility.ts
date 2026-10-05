import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'
import { voipCalls } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only calls they initiated (outbound)
 * or picked up (inbound) — i.e., `agent_user_id` matches the session user.
 *
 * Super-admin queries bypass this via the omni-scope path.
 */
export function voipCallVisibility({ userId }: VisibilityScope): SQL {
  return eq(voipCalls.agentUserId, userId)
}
