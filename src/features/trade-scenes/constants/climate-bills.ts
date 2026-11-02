import type { SavingsCategory } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'

// Until the rep sets coastal or inland, the scene reads as inland: the hotter, costlier of the two climates.
export const CLIMATE_FALLBACK: Climate = 'inland'

// A typical monthly bill per climate, so the savings figures read from the first tap before any bill is typed.
export const CLIMATE_DEFAULT_BILLS: Record<Climate, Record<SavingsCategory, number>> = {
  inland: { electric: 200, gas: 100 },
  coastal: { electric: 155, gas: 110 },
}
