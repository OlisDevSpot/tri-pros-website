import type { NetWorthProjectionConfig } from '@/features/calculators/net-worth-projection-calculator/schemas/config'

import { NET_WORTH_PROJECTION_CONFIG_DEFAULTS } from '@/features/calculators/net-worth-projection-calculator/constants/config-defaults'
import { netWorthProjectionConfigSchema } from '@/features/calculators/net-worth-projection-calculator/schemas/config'

// Admin-configured savings defaults have no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveNetWorthProjectionConfig(): NetWorthProjectionConfig {
  return netWorthProjectionConfigSchema.parse(NET_WORTH_PROJECTION_CONFIG_DEFAULTS)
}
