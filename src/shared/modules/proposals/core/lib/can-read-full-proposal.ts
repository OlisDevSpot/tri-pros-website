import type { AppAbility } from '@/shared/domains/permissions/types'

/** Staff read the raw scope of work; a share-link holder's rules don't list `projectJSON`. */
export function canReadFullProposal(ability: AppAbility): boolean {
  return ability.can('read', 'Proposal', 'projectJSON')
}
