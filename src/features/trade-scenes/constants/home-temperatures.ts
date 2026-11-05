import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { HeatWeather } from '@/shared/modules/construction/core/types'

import { THERMAL_PALETTES } from '@/shared/components/scene/constants/thermal-palettes'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

// A real thermal camera keeps one palette whatever the weather, so a colour means the same °F in every view.
export const HOME_THERMAL_PALETTE = THERMAL_PALETTES.ironbow.summer

// Southern California rain falls in the heating season, and the readings' presets have no storm, so a storm paints against
// the winter air and thermostat.
export const RAIN_PRESET_WEATHER: HeatWeather = 'winter'

// Working number, sourced before release: skin and clothes read near body heat through a thermal camera.
export const RESIDENT_F = 98

// Working number, sourced before release: how far above the outside air a condenser running flat out reads; it rejects the
// house's heat, so it always reads above the air around it.
export const CONDENSER_FULL_LOAD_RISE_F = 30

// Working number, sourced before release: how far above the room a furnace, its ducts or a heating head read at full load.
export const HEATING_FULL_LOAD_RISE_F = 30

// Working number, sourced before release: how far below the room the ducts or a cooling head read at full load.
export const COOLING_FULL_LOAD_DROP_F = 10

// Working number, sourced before release: the share of the summer solar gain a sunlit stucco wall carries.
export const SUNLIT_WALL_SOLAR_SHARE = 0.3

// Working number, sourced before release: evaporation holds a soaked surface this far below the air around it.
export const SOAKED_DROP_F = 5

// Working number, sourced before release: an open sky reads colder than anything on the ground, so it sits on the scale's floor.
export const SKY_F = THERMAL_SCALE_F.min

// Every 40 °F on the fixed scale: few enough to read at a glance from across a table.
export const THERMAL_LEGEND_TICKS = 5

// Working number, sourced before release: the ground holds a crawl space near its own steady temperature, so it swings far less
// than the air outside; Normal sits at the mean of the two seasons.
export const CRAWL_AIR = {
  inland: { summer: 72, winter: 50 },
  coastal: { summer: 68, winter: 53 },
} as const satisfies Record<Climate, Record<'summer' | 'winter', number>>

// Working number, sourced before release: how far toward the room a floor with no insulation reads from the crawl air, as the
// house's heat leaks down through it.
export const BARE_FLOOR_LEAK_SHARE = 0.85
