import type { HomeHeat, PartPaint, SystemPartId } from '@/features/trade-scenes/types'

import { DEFAULT_PART_PAINT_FACES, PART_PAINT_FACES } from '@/features/trade-scenes/constants/look-inside'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

// The system parts the stepped roof and attic paint through their depth; every other part takes its zone's paint.
export const PAINTED_SYSTEM_PARTS: readonly SystemPartId[] = SYSTEM_PARTS
  .filter(entry => (entry.systems as readonly string[]).some(system => system === 'roof' || system === 'attic'))
  .map(entry => entry.id)

const PAINTED: ReadonlySet<SystemPartId> = new Set(PAINTED_SYSTEM_PARTS)

// What the thermal camera paints each lit system part, from its face toward the rooms to its face toward the sky: each face
// reads as the home's reading it faces, so the steps and the zones round them never disagree.
export function partPaintTemperatures(shown: Iterable<SystemPartId>, heat: HomeHeat): Partial<Record<SystemPartId, PartPaint>> {
  const onScale = (fahrenheit: number) => normalizeOnScale(fahrenheit, THERMAL_SCALE_F)
  const painted: Partial<Record<SystemPartId, PartPaint>> = {}
  for (const id of shown) {
    if (!PAINTED.has(id)) {
      continue
    }
    const faces = PART_PAINT_FACES[id] ?? DEFAULT_PART_PAINT_FACES
    painted[id] = { inner: onScale(heat.readings[faces.inner]), outer: onScale(heat.readings[faces.outer]) }
  }
  return painted
}
