import type { HomeReadings } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { ResolvedPart, WaterFlow, Weather } from '@/shared/modules/construction/core/types'

import { KIT_DEFAULT_PAINT_FACES, KIT_FRAME_PAINT_ZONE, KIT_PART_PAINT_FACES } from '@/features/trade-scenes/constants/roof-attic-flows'
import { homePaintTemperatures } from '@/features/trade-scenes/lib/home-paint-temperatures'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

/** A part's temperatures on the fixed thermal scale, 0..1: its face toward the rooms and its face toward the sky. */
export interface PartPaint {
  inner: number
  outer: number
}

interface KitPaintSources {
  parts: readonly ResolvedPart[]
  water: WaterFlow | null
  weather: Weather
  climate: Climate
  readings: HomeReadings | null
}

// What the thermal camera paints each kit part: each face reads as the home's zone it faces, so the zoomed kit and the house never
// disagree, and a part the rain soaked reads as the home's soaked parts do.
export function kitPaintTemperatures({ parts, water, weather, climate, readings }: KitPaintSources): { parts: Record<string, PartPaint>, frame: PartPaint } {
  const home = homePaintTemperatures({ readings, equipmentLoad: 0, weather, climate })
  const onScale = (fahrenheit: number) => normalizeOnScale(fahrenheit, THERMAL_SCALE_F)
  const flat = (fahrenheit: number): PartPaint => ({ inner: onScale(fahrenheit), outer: onScale(fahrenheit) })
  const soaked = new Set(water ? Object.keys(water.soaked).filter(id => water.soaked[id] > 0) : [])

  const painted: Record<string, PartPaint> = {}
  for (const part of parts) {
    if (part.material === null) {
      continue
    }
    const faces = KIT_PART_PAINT_FACES[part.id] ?? KIT_DEFAULT_PAINT_FACES
    painted[part.id] = soaked.has(part.id)
      ? flat(home.soaked)
      : { inner: onScale(home[faces.inner]), outer: onScale(home[faces.outer]) }
  }
  return { parts: painted, frame: flat(home[KIT_FRAME_PAINT_ZONE]) }
}
