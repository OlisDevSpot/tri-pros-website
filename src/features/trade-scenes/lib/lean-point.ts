import type { HomeSystemId, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { PULLED_APART_SYSTEMS } from '@/features/trade-scenes/constants/look-inside'
import { WALL_LEAN_POINTS } from '@/features/trade-scenes/constants/system-camera-views'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'

// Where the camera leans for a picked part up close. A stepped part is leaned to where its step shows, so the lean follows
// the peel; a part that pulls apart is leaned to where it stands at rest, so the camera stays put while the slider moves and
// the view framed for the full spread keeps it. The wall's parts have no place to pin, so the walls lean on points of their own.
export function leanPoint(system: HomeSystemId, form: RoofForm, part: SystemPartId, peel: number, shown: Iterable<SystemPartId>, ductRun: readonly Vec3[]): Vec3 | null {
  if (system === 'walls') {
    return WALL_LEAN_POINTS[form][part] ?? null
  }
  return systemPartFocus(system, form, part, PULLED_APART_SYSTEMS.has(system) ? 0 : peel, shown, ductRun)
}
