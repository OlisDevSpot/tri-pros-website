import type { BoxSpec } from '@/features/trade-scenes/types'

import { PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { COVERING_BASE, HOUSE, LOW_SLOPE_ROOF_Y, RAFTER_ORIGIN_Y } from '@/features/trade-scenes/constants/home-geometry'
import { SHINGLE } from '@/features/trade-scenes/lib/home-roof-layout'

export interface PackageUnitPlacement {
  /** Where the unit's base centre stands, on top of its curb. */
  position: readonly [number, number, number]
  curb: BoxSpec
}

const CURB_MARGIN = 0.1
// Sunk into the covering at the low edge so the curb never floats on the slope.
const CURB_SINK = 0.03
const COVERED_OFFSET = (COVERING_BASE + SHINGLE.thickness) / Math.cos(HOUSE.pitch)

// The near slope's covered surface height at world z.
function slopeY(z: number): number {
  return RAFTER_ORIGIN_Y + (HOUSE.halfDepth - z) * Math.tan(HOUSE.pitch) + COVERED_OFFSET
}

// A level curb under the unit: on the flat roof a plain upstand, on the slope tall enough at the low edge that the unit's
// base is level across the pitch.
export function packageUnitPlacement(lowSlope: boolean, scale: number): PackageUnitPlacement {
  const [length, , depth] = PACKAGE_UNIT.size
  const footprint: readonly [number, number] = [length * scale + CURB_MARGIN, depth * scale + CURB_MARGIN]
  if (lowSlope) {
    const { x, z } = PACKAGE_UNIT.flat
    return {
      position: [x, LOW_SLOPE_ROOF_Y + PACKAGE_UNIT.curbHeight, z],
      curb: { size: [footprint[0], PACKAGE_UNIT.curbHeight, footprint[1]], position: [x, LOW_SLOPE_ROOF_Y + PACKAGE_UNIT.curbHeight / 2, z] },
    }
  }
  const x = PACKAGE_UNIT.gableX
  const z = PACKAGE_UNIT.gableZ
  const top = slopeY(z - footprint[1] / 2) + PACKAGE_UNIT.curbHeight
  const bottom = slopeY(z + footprint[1] / 2) - CURB_SINK
  return {
    position: [x, top, z],
    curb: { size: [footprint[0], top - bottom, footprint[1]], position: [x, (top + bottom) / 2, z] },
  }
}
