import type { Vec3 } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

import { SCENE_ATTRIBUTES } from '@/features/trade-scenes/constants/scene-attributes'
import { WEATHER_SKIES } from '@/features/trade-scenes/constants/weather-skies'
import { sunDirection } from '@/features/trade-scenes/lib/sun-direction'
import { sunPosition } from '@/features/trade-scenes/lib/sun-position'

export function weatherSunDirection(weather: Weather): Vec3 {
  const { day, hour, minElevation } = WEATHER_SKIES[weather].sun
  return sunDirection(sunPosition(day, hour), SCENE_ATTRIBUTES.frontBearing, minElevation)
}
