import type { AppAbility } from '@/shared/domains/permissions/types'

/**
 * Render-site helper: did the DAL gate this customer's phone, or is it
 * genuinely empty? see ../DOCS.md#phone-visibility-threshold
 *
 * Super-admins always see the phone; agents see it once `hasSentProposal`
 * is true (a proposal at status `sent` or `approved`). The DAL is the
 * actual gate — this predicate just decides whether to show "unlock" vs
 * "add phone" affordance for null values.
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
