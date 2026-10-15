import type { AppAbility } from '@/shared/domains/permissions/types'

/**
 * Who sees a customer's phone before any proposal goes out: omni callers (super-admin, and the system,
 * which holds `manage all`) and the leads-pool workers (dispatchers, who dial leads). The SQL gate and
 * the profile's unlock notice both ask this, so they cannot disagree.
 */
export function canSeeUngatedPhone(ability: AppAbility): boolean {
  return ability.can('manage', 'all') || ability.can('read', 'LeadsPool')
}
