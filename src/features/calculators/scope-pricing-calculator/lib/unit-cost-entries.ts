import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { UNIT_COST_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/unit-cost-labels'

export function unitCostEntries(config: ScopePricingConfig, trade: PricingTrade): { key: string, label: string, value: number }[] {
  const labels: Record<string, string> = UNIT_COST_LABELS[trade]
  return Object.entries(config.unitCosts[trade]).map(([key, value]) => ({ key, label: labels[key] ?? key, value }))
}
