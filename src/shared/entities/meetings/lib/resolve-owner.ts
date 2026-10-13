import type { AppAbility } from '@/shared/domains/permissions/types'

import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'

/**
 * Server-authoritative owner for an authed create. NEVER trusts input ownerId.
 * - Users who can `own` a Meeting (agents, super-admin) → own it themselves.
 * - Users who cannot (dispatchers) → the system account owns it, i.e. the
 *   meeting is UNASSIGNED, awaiting dispatch.
 * The caller passes a real user: the hook returns early when there is none.
 */
export async function resolveMeetingOwnerId(userId: string, ability: AppAbility): Promise<string> {
  if (ability.can('own', 'Meeting')) {
    return userId
  }
  return getSystemOwnerId()
}
