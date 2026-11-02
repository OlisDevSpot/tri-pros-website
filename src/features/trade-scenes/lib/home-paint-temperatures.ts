import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { HomeReadings } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { Weather } from '@/shared/modules/construction/core/types'

import { BARE_FLOOR_LEAK_SHARE, CONDENSER_FULL_LOAD_RISE_F, COOLING_FULL_LOAD_DROP_F, CRAWL_AIR, HEATING_FULL_LOAD_RISE_F, RAIN_PRESET_WEATHER, RESIDENT_F, SKY_F, SOAKED_DROP_F, SUNLIT_WALL_SOLAR_SHARE } from '@/features/trade-scenes/constants/home-temperatures'
import { CLIMATE_PRESETS, HEAT_WEATHER_PROFILES, SOLAR_GAIN_F } from '@/shared/modules/construction/core/constants/climate-presets'

interface HomePaintSources {
  readings: HomeReadings | null
  /** 0..1 */
  equipmentLoad: number
  weather: Weather
  climate: Climate
  /** The floor over a raised foundation has batts under it. */
  crawlInsulated?: boolean
}

// °F for every surface the thermal camera paints, from the same readings the pins show, so a colour and a number never disagree.
export function homePaintTemperatures({ readings, equipmentLoad, weather, climate, crawlInsulated = false }: HomePaintSources): Record<HomePaintKey, number> {
  const heatWeather = weather === 'rain' ? RAIN_PRESET_WEATHER : weather
  const { outside, setpoint } = CLIMATE_PRESETS[climate][heatWeather]
  const sun = weather === 'rain' ? 0 : HEAT_WEATHER_PROFILES[weather].sun
  const soaked = outside - SOAKED_DROP_F
  // With no readings (a storm has none) the roof and attic sit at the air outside and the ceiling at the room.
  const roof = readings?.roof ?? outside
  const ceiling = readings?.ceiling ?? setpoint
  const attic = readings?.attic ?? outside
  // A storm paints against the winter ground, as it does the winter air.
  const ground = CRAWL_AIR[climate]
  const crawl = heatWeather === 'normal' ? (ground.summer + ground.winter) / 2 : ground[heatWeather]

  return {
    roof,
    attic,
    ceiling,
    'interior': setpoint,
    'exterior': outside,
    'sunlit': readings?.['exterior-wall'] ?? (outside + SOLAR_GAIN_F * sun * SUNLIT_WALL_SOLAR_SHARE),
    // Glass has no reading in a storm, so it sits between the air outside and the room.
    'window': readings?.window ?? (outside + setpoint) / 2,
    // The condenser stays tagged in every weather, so only a summer load runs it; the heating and cooling sides are tagged
    // only in their own weather.
    'condenser': outside + CONDENSER_FULL_LOAD_RISE_F * (weather === 'summer' ? equipmentLoad : 0),
    'heating': setpoint + HEATING_FULL_LOAD_RISE_F * equipmentLoad,
    'cooling': setpoint - COOLING_FULL_LOAD_DROP_F * equipmentLoad,
    'resident': RESIDENT_F,
    'sky': SKY_F,
    'leak': soaked,
    crawl,
    // Batts hold the floor at the crawl air; bare, the room's heat leaks down and warms it toward the setpoint.
    'crawl-floor': crawlInsulated ? crawl : crawl + (setpoint - crawl) * BARE_FLOOR_LEAK_SHARE,
    soaked,
  }
}
