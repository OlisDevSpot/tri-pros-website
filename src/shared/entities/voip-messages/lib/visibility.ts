import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { voipMessages } from '@/shared/db/schema'

/**
 * Agent-visibility predicate. An agent sees only SMS records they sent (outbound)
 * or received (inbound on their DID with the agent picked up via the thread UI).
 *
 * Inbound STOP-keyword SMS to a DID without an agent attached (e.g., main line)
 * are written by webhook handlers under SYSTEM_CONTEXT — visible only to admin.
 *
 * Super-admin queries bypass this via the omni-scope path.
 * see ../DOCS.md#visibility-via-agent-ownership
 */
export function voipMessageVisibility(userId: string): SQL {
  return eq(voipMessages.agentUserId, userId)
}
