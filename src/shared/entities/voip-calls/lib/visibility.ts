import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { voipCalls } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only calls they initiated (outbound)
 * or picked up (inbound) — i.e., `agent_user_id` matches the session user.
 *
 * Super-admin queries bypass this via the omni-scope path (see src/trpc/DOCS.md).
 * see ../DOCS.md#visibility-via-agent-ownership
 */
export function voipCallVisibility(userId: string): SQL {
  return eq(voipCalls.agentUserId, userId)
}
