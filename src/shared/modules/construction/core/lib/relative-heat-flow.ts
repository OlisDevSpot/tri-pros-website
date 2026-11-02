import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { Assembly, FlowProfile, HeatWeather, ResolvedPart } from '@/shared/modules/construction/core/types'

import { HEAT_WEATHER_PROFILES, THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'
import { DRAWING_REFERENCE_R_VALUE } from '@/shared/modules/construction/core/constants/flow-model'
import { reflectanceIn, resistanceOf, thermalWalk } from '@/shared/modules/construction/core/lib/thermal-walk'

const onThermalScale = (fahrenheit: number) => Math.min(1, Math.max(0, (fahrenheit - THERMAL_SCALE_F.min) / (THERMAL_SCALE_F.max - THERMAL_SCALE_F.min)))

// Ribbon widths: each part's R-value narrows the ribbon, and a part that reflects in this season turns back its share where the walk
// crosses it. Only the source-side surface counts as "sent back"; inner reflectors (a radiant barrier) narrow what comes after them.
// Summer flows outside → in; winter flows inside → out. The face temperatures are the readings walk, so the paint and the pinned °F agree.
export function relativeHeatFlow(assembly: Assembly, parts: ResolvedPart[], weather: HeatWeather, climate: Climate): FlowProfile {
  const { season, flow } = HEAT_WEATHER_PROFILES[weather]
  const fromSource = season === 'summer' ? [...parts].reverse() : parts

  // Fittings with no thermal data (a ridge vent, a gutter) sit beyond the surface and never count as it.
  const outerIndex = fromSource.findIndex(part => part.condition !== 'absent' && part.thermal !== null)
  const reflected = outerIndex >= 0 ? reflectanceIn(fromSource[outerIndex], season) : 0

  const boundaries = [1 - reflected]
  let crossedR = 0
  let kept = 1 - reflected
  fromSource.forEach((part, index) => {
    crossedR += resistanceOf(part)
    if (index !== outerIndex)
      kept *= 1 - reflectanceIn(part, season)
    boundaries.push(kept / (1 + crossedR / DRAWING_REFERENCE_R_VALUE))
  })

  const { faces } = thermalWalk(assembly, parts, weather, climate)
  const temperatures: FlowProfile['parts'] = Object.fromEntries(Object.entries(faces).map(([id, face]) => [id, { inner: onThermalScale(face.inner), outer: onThermalScale(face.outer) }]))

  return { boundaries: boundaries.map(boundary => boundary * flow), parts: temperatures, reflected: reflected * flow }
}
