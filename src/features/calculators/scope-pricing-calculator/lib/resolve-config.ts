import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { SCOPE_PRICING_CONFIG_DEFAULTS } from '@/features/calculators/scope-pricing-calculator/constants/config-defaults'
import { scopePricingConfigSchema } from '@/features/calculators/scope-pricing-calculator/schemas/config'

// Admin-configured pricing has no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveScopePricingConfig(): ScopePricingConfig {
  return scopePricingConfigSchema.parse(SCOPE_PRICING_CONFIG_DEFAULTS)
}
