import type { ScopedContext } from '@/shared/dal/server/types'

import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'

/**
 * Server-authoritative owner for an authed create. NEVER trusts input ownerId.
 * - Users who can `own` a Meeting (agents, super-admin) → own it themselves.
 * - Users who cannot (dispatchers) → the system account owns it, i.e. the
 *   meeting is UNASSIGNED, awaiting dispatch. see ../DOCS.md#system-account-not-a-person
 * Caller guarantees ctx.session (authed path only); SYSTEM_CONTEXT is handled
 * by the hook's passthrough before this is called.
 */
export async function resolveMeetingOwnerId(ctx: ScopedContext): Promise<string> {
  if (ctx.ability?.can('own', 'Meeting')) {
    return ctx.session!.user.id
  }
  return getSystemOwnerId()
}
