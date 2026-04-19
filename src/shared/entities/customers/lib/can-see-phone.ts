import type { AppAbility } from '@/shared/domains/permissions/types'

/**
 * Determine whether the current viewer may see a customer's phone number.
 *
 * Rule: super-admins always see the phone; agents only see it once the
 * customer has at least one proposal sent. The DAL enforces this by nulling
 * `phone` in query results — this predicate exists so render sites can
 * distinguish "null because gated" (show unlock tooltip) from "null because
 * the customer genuinely has no phone" (super-admins only; show Add button).
 */
export function canAgentSeePhone(
  ability: AppAbility,
  customer: { hasSentProposal?: boolean | null },
): boolean {
  if (ability.can('manage', 'all')) {
    return true
  }
  return customer.hasSentProposal === true
}
