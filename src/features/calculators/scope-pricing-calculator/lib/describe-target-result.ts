import type { SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

export function describeTargetResult(result: SolveMultiplierResult | null, floor: number): string {
  if (result == null) {
    return 'Enter a total and the multiplier is solved for you.'
  }
  if (!('multiplier' in result)) {
    return result.status === 'no-cost'
      ? 'Only lines with a formula have cost data, so a target needs at least one.'
      : 'Every costed scope has its own multiplier, so there is nothing left to solve. Clear one to use a target.'
  }
  if (result.status === 'below-floor') {
    return `Out of reach without going under the ${formatMultiplier(floor)} floor. Lowest price: ${formatAsDollars(result.achievedTotal)}.`
  }
  return `${formatMultiplier(result.multiplier)} gives ${formatAsDollars(result.achievedTotal)}.`
}
