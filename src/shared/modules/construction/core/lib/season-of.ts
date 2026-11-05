import type { Season, Weather } from '@/shared/modules/construction/core/types'

import { HEAT_WEATHER_PROFILES } from '@/shared/modules/construction/core/constants/climate-presets'

export function seasonOf(weather: Weather): Season | null {
  return weather === 'rain' ? null : HEAT_WEATHER_PROFILES[weather].season
}
