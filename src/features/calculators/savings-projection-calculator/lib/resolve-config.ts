import type { SavingsProjectionConfig } from '@/features/calculators/savings-projection-calculator/schemas/config'

import { SAVINGS_PROJECTION_CONFIG_DEFAULTS } from '@/features/calculators/savings-projection-calculator/constants/config-defaults'
import { savingsProjectionConfigSchema } from '@/features/calculators/savings-projection-calculator/schemas/config'

// Admin-configured savings defaults have no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveSavingsProjectionConfig(): SavingsProjectionConfig {
  return savingsProjectionConfigSchema.parse(SAVINGS_PROJECTION_CONFIG_DEFAULTS)
}
