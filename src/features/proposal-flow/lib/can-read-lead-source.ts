import type { AppAbility } from '@/shared/domains/permissions/types'

// Mirrors the lead-source router's super-admin guard, so other roles never send a read it refuses.
export function canReadLeadSource(ability: AppAbility): boolean {
  return ability.can('manage', 'all')
}
