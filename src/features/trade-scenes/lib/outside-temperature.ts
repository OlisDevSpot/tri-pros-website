import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { CLIMATE_PRESETS } from '@/shared/modules/construction/core/constants/climate-presets'

// A rainy day has no preset to read, and a number would claim one.
export function outsideTemperature({ weather, climate }: Pick<TradeSceneInputs, 'weather' | 'climate'>): number | null {
  if (weather === 'rain') {
    return null
  }
  return CLIMATE_PRESETS[climate ?? CLIMATE_FALLBACK][weather].outside
}
