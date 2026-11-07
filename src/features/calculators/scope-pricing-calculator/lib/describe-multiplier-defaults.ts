import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

export function describeMultiplierDefaults(config: ScopePricingConfig, pricingKeys: readonly PricingKey[], proposalMultiplier: number): string {
  const { default: defaultMultiplier, floor, byScope } = config.multiplier
  const parts = [`Floor ${formatMultiplier(floor)}`, `default ${formatMultiplier(defaultMultiplier)}`]
  for (const key of new Set(pricingKeys)) {
    const scopeDefault = byScope[key]
    if (scopeDefault != null) {
      parts.push(`${FORMULAS[key].label} ${formatMultiplier(scopeDefault)}`)
    }
  }
  const shift = proposalMultiplier - defaultMultiplier
  // Below half a hundredth the shift prints as 0.00x, so naming it would only add noise.
  if (Math.abs(shift) >= 0.005) {
    parts.push(`${shift > 0 ? '+' : '−'}${formatMultiplier(Math.abs(shift))} on every scope`)
  }
  return parts.join(' · ')
}
