import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'

import { PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { COVERING_BASE, HOUSE, LOW_SLOPE_ROOF_Y } from '@/features/trade-scenes/constants/home-geometry'
import { SHINGLE } from '@/features/trade-scenes/lib/home-roof-layout'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'

// A level-topped curb whose underside runs straight from its back edge to its front edge, so on a slope it follows the
// roof instead of a flat box's bottom cutting down through the deck.
export interface UnitCurb {
  /** The centre of its footprint, [x, z]. */
  at: readonly [number, number]
  /** [along the ridge, depth]. */
  footprint: readonly [number, number]
  top: number
  /** The underside's height at the back edge (lower z) and at the front edge. */
  bottom: { back: number, front: number }
}

export interface PackageUnitPlacement {
  /** Where the unit's base centre stands, on top of its curb. */
  position: Vec3
  curb: UnitCurb
}

const CURB_MARGIN = 0.1
// Sunk into the covering so the curb never floats on the slope, and shallow enough to stay above the deck's underside.
// A working number.
const CURB_SINK = 0.02
const COVERED_OFFSET = (COVERING_BASE + SHINGLE.thickness) / Math.cos(HOUSE.pitch)

// The covered surface's height at world z, on either slope.
function slopeY(z: number): number {
  return roofUndersideY(z, 'pitched') + COVERED_OFFSET
}

// A level curb under the unit: on the flat roof a plain upstand, on the far slope sunk just under the covering along its
// whole underside and standing its height above the high edge, the one toward the ridge, so the unit's base is level.
export function packageUnitPlacement(lowSlope: boolean, scale: number): PackageUnitPlacement {
  const [length, , depth] = PACKAGE_UNIT.size
  const footprint: readonly [number, number] = [length * scale + CURB_MARGIN, depth * scale + CURB_MARGIN]
  if (lowSlope) {
    const { x, z } = PACKAGE_UNIT.flat
    const top = LOW_SLOPE_ROOF_Y + PACKAGE_UNIT.curbHeight
    return { position: [x, top, z], curb: { at: [x, z], footprint, top, bottom: { back: LOW_SLOPE_ROOF_Y, front: LOW_SLOPE_ROOF_Y } } }
  }
  const x = PACKAGE_UNIT.gableX
  const z = PACKAGE_UNIT.gableZ
  const back = z - footprint[1] / 2
  const front = z + footprint[1] / 2
  const top = slopeY(front) + PACKAGE_UNIT.curbHeight
  return { position: [x, top, z], curb: { at: [x, z], footprint, top, bottom: { back: slopeY(back) - CURB_SINK, front: slopeY(front) - CURB_SINK } } }
}

// The duct the unit's air comes down: from the curb's underside, through the deck, into the top of the trunk. It starts
// where the underside is highest over it, so no gap opens between the two anywhere across the slope.
export function packageUnitDrop({ position: [x, , z], curb }: PackageUnitPlacement): BoxSpec {
  const [width, depth] = PACKAGE_UNIT.drop
  const { at: [, curbZ], footprint: [, curbDepth], bottom: { back, front } } = curb
  const underside = (at: number) => back + (front - back) * (at - (curbZ - curbDepth / 2)) / curbDepth
  const top = Math.max(underside(z - depth / 2), underside(z + depth / 2))
  const bottom = PACKAGE_UNIT.trunk.top
  return { size: [width, top - bottom, depth], position: [x, (top + bottom) / 2, z] }
}
