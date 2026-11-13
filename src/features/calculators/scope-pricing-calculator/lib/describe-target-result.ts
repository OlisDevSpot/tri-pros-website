import type { SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

export function describeTargetResult(result: SolveMultiplierResult | null, floor: number): string {
  if (result == null) {
    return 'Enter a total and the multiplier is solved for you.'
  }
  if (!('multiplier' in result)) {
    return result.status === 'no-cost'
      ? 'A target needs at least one scope with a cost.'
      : 'Every costed scope has its own multiplier, so there is nothing left to solve. Clear one to use a target.'
  }
  if (result.status === 'below-floor') {
    return `Out of reach with the proposal-wide multiplier at the ${formatMultiplier(floor)} floor. Lowest price this way: ${formatAsDollars(result.achievedTotal)}.`
  }
  return `${formatMultiplier(result.multiplier)} gives ${formatAsDollars(result.achievedTotal)}.`
}
