import type { SavingsCategory } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'

import { CLIMATE_DEFAULT_BILLS, CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'

// The bill a field falls back to while nothing is typed: the climate's, or inland's until coastal or inland is set.
export function climateDefaultBill(climate: Climate | null, category: SavingsCategory): number {
  return CLIMATE_DEFAULT_BILLS[climate ?? CLIMATE_FALLBACK][category]
}
