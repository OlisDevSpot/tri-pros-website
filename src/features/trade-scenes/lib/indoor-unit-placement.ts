import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'
import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { INDOOR_UNIT_PLACEMENTS } from '@/features/trade-scenes/constants/indoor-unit-placements'

export type IndoorUnitSectionId = 'blower' | 'furnace' | 'coil' | 'plenum'

export interface IndoorUnitPlacement {
  upright: boolean
  // The middle of the return end: on the attic floor for a flat unit, on the closet floor for an upright one.
  base: Vec3
  // Unit vector from the return toward the plenum, along one axis.
  toward: Vec3
  // Across the line: [x, z] for an upright unit; [across the attic floor, height] for a flat one.
  section: readonly [width: number, depth: number]
  lengths: Readonly<Record<IndoorUnitSectionId, number>>
  // From beside the coil to the left wall's outside, over where the condenser's own lines come into it.
  lineSet: readonly Vec3[]
  // The closet's walls and door; none in the attic.
  closet: readonly BoxSpec[]
  // Where the plenum's air meets today's duct runs, so the runs, boots and their checks do not move.
  trunk: readonly Vec3[]
}

export function indoorUnitPlacement(location: HvacIndoorLocation, form: RoofForm): IndoorUnitPlacement | null {
  return INDOOR_UNIT_PLACEMENTS[location]?.[form] ?? null
}
