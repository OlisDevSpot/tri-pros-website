import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { Assembly, HeatWeather, ResolvedPart, Season, ThermalReadings, ThermalWalk } from '@/shared/modules/construction/core/types'

import { CAVITY_VENT_R, CLIMATE_PRESETS, HEAT_WEATHER_PROFILES, INSIDE_FILM_R, NIGHT_SKY_DROP_F, OUTSIDE_FILM_R, SOLAR_GAIN_F } from '@/shared/modules/construction/core/constants/climate-presets'

type Faces = ThermalWalk['faces']

export function resistanceOf(part: ResolvedPart): number {
  return part.condition === 'absent' ? 0 : part.thermal?.rValue ?? 0
}

// A part reflects only in the season it acts: a cool roof turns back summer sun, a radiant barrier also turns back winter warmth.
export function reflectanceIn(part: ResolvedPart, season: Season): number {
  if (part.condition === 'absent') {
    return 0
  }
  return (season === 'summer' ? part.thermal?.reflectance : part.thermal?.winterReflectance) ?? 0
}

// Temperatures fall linearly with crossed resistance between the path's two ends.
function walkPath(outsideIn: readonly ResolvedPart[], resistance: (part: ResolvedPart) => number, from: number, to: number, totalR: number, startR: number, faces: Faces) {
  const at = (crossedR: number) => from - (from - to) * crossedR / totalR
  let crossedR = startR
  for (const part of outsideIn) {
    const outer = at(crossedR)
    crossedR += resistance(part)
    faces[part.id] = { inner: at(crossedR), outer }
  }
}

// Steady state, in °F. The outer surface takes the sun (or the night sky); an assembly with a cavity solves its air as the node where
// the outer path, the inner path and the venting meet. Parts are stored inside → out.
export function thermalWalk(assembly: Assembly, parts: ResolvedPart[], weather: HeatWeather, climate: Climate): ThermalWalk {
  const { outside, setpoint } = CLIMATE_PRESETS[climate][weather]
  const { season, sun } = HEAT_WEATHER_PROFILES[weather]
  const outerGroup = assembly.readings?.outerGroup
  const outer = outerGroup === undefined ? parts : parts.filter(part => part.group === outerGroup)
  const inner = outerGroup === undefined ? [] : parts.filter(part => part.group !== outerGroup)
  const outerOutsideIn = [...outer].reverse()

  // Fittings with no thermal data (a ridge vent, a gutter) sit beyond the surface and never count as it.
  const surface = outerOutsideIn.find(part => part.condition !== 'absent' && part.thermal !== null)
  const source = season === 'summer'
    ? outside + SOLAR_GAIN_F * sun * (1 - (surface ? reflectanceIn(surface, season) : 0))
    : outside - NIGHT_SKY_DROP_F

  // A reflector beneath the surface turns back part of what reaches it, which acts as resistance where it sits: the whole outer
  // path's resistance grows by 1 / (1 − reflectance), and that growth is placed at the reflector so the drop shows across it.
  const rawOuterR = OUTSIDE_FILM_R + outer.reduce((sum, part) => sum + resistanceOf(part), 0)
  const outerResistance = new Map<string, number>()
  let scale = 1
  for (const part of outerOutsideIn) {
    const grown = part === surface ? scale : scale / (1 - reflectanceIn(part, season))
    outerResistance.set(part.id, resistanceOf(part) + rawOuterR * (grown - scale))
    scale = grown
  }
  const outerR = rawOuterR * scale
  const innerR = inner.reduce((sum, part) => sum + resistanceOf(part), 0) + INSIDE_FILM_R

  const faces: Faces = {}
  let readings: ThermalReadings
  if (outerGroup === undefined) {
    const totalR = outerR + innerR
    walkPath(outerOutsideIn, part => outerResistance.get(part.id)!, source, setpoint, totalR, OUTSIDE_FILM_R, faces)
    readings = {
      outerSurface: source - (source - setpoint) * OUTSIDE_FILM_R / totalR,
      cavityAir: null,
      innerSurface: setpoint + (source - setpoint) * INSIDE_FILM_R / totalR,
    }
  }
  else {
    const cavity = (source / outerR + setpoint / innerR + outside / CAVITY_VENT_R) / (1 / outerR + 1 / innerR + 1 / CAVITY_VENT_R)
    walkPath(outerOutsideIn, part => outerResistance.get(part.id)!, source, cavity, outerR, OUTSIDE_FILM_R, faces)
    walkPath([...inner].reverse(), resistanceOf, cavity, setpoint, innerR, 0, faces)
    readings = {
      outerSurface: source - (source - cavity) * OUTSIDE_FILM_R / outerR,
      cavityAir: cavity,
      innerSurface: setpoint + (cavity - setpoint) * INSIDE_FILM_R / innerR,
    }
  }

  return { readings, faces: Object.fromEntries(parts.map(part => [part.id, faces[part.id]])) }
}
