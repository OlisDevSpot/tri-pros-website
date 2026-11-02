import type { HeatWeather, Season } from '@/shared/modules/construction/core/types'

export const CLIMATES = ['coastal', 'inland'] as const
export type Climate = (typeof CLIMATES)[number]

export const CLIMATE_LABELS = { coastal: 'Coastal', inland: 'Inland' } as const satisfies Record<Climate, string>

// Working numbers, sourced before release: normal is a mild afternoon, summer a peak afternoon, winter a clear night; the setpoint is the thermostat.
export const CLIMATE_PRESETS = {
  coastal: { normal: { outside: 74, setpoint: 76 }, summer: { outside: 82, setpoint: 76 }, winter: { outside: 45, setpoint: 70 } },
  inland: { normal: { outside: 78, setpoint: 76 }, summer: { outside: 100, setpoint: 76 }, winter: { outside: 38, setpoint: 70 } },
} as const satisfies Record<Climate, Record<HeatWeather, { outside: number, setpoint: number }>>

// Working numbers, sourced before release: the share of the peak-afternoon sun and of the peak heat flow each heat weather carries.
export const HEAT_WEATHER_PROFILES = {
  normal: { season: 'summer', sun: 0.45, flow: 0.35 },
  summer: { season: 'summer', sun: 1, flow: 1 },
  winter: { season: 'winter', sun: 0, flow: 1 },
} as const satisfies Record<HeatWeather, { season: Season, sun: number, flow: number }>

// Working number, sourced before release: how far a black surface climbs above the air at a summer peak.
export const SOLAR_GAIN_F = 80

// Working number, sourced before release: a clear night sky pulls the roof below the air around it.
export const NIGHT_SKY_DROP_F = 5

// Working number, sourced before release: the moving-air film on the sky side of the roof.
export const OUTSIDE_FILM_R = 0.25

// Working number, sourced before release: the still-air film under the ceiling.
export const INSIDE_FILM_R = 0.68

// Working number, sourced before release: soffit and ridge venting ties the attic air back to the outside air.
export const CAVITY_VENT_R = 2.2

// Working number, sourced before release: one fixed scale for every reading and the paint, so colours compare across scenes.
export const THERMAL_SCALE_F = { min: 20, max: 180 } as const
