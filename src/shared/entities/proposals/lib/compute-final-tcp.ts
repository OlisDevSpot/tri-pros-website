import type { FundingSection } from '@/shared/entities/proposals/types'

/**
 * Canonical final contract price (TCP) for a proposal.
 *
 * Pure derived value — never persisted. Formula:
 *
 *     finalTcp = max(0, startingTcp − sum(discount incentives))
 *
 * `startingTcp` is already the post-breakdown number (in 'breakdown'
 * pricing mode the form syncs startingTcp = Σ sow.price + miscPrice
 * before this function is called), so this helper does not need to
 * know about pricing mode. Only `discount`-typed incentives reduce the
 * price — `exclusive-offer` incentives are informational and do not
 * affect TCP.
 *
 * Keep this as the SINGLE source of truth for TCP. Any code that needs
 * the final price must call this; do not recompute inline or read a
 * cached field.
 */
export function computeFinalTcp(data: FundingSection['data']): number {
  const totalDiscounts = data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
  return Math.max(0, data.startingTcp - totalDiscounts)
}
