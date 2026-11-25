import type { BoxSpec, LotBoxes } from '@/features/trade-scenes/types'

import { FRONT_STOOP } from '@/features/trade-scenes/constants/home-details'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, GRADE, LOT, MULCH_BEDS, STREET_BAND, STREET_Z, WALK } from '@/features/trade-scenes/constants/home-lot'
import { boards, capsOf, padToFront, run, SLAB, STREET_SPAN, streetBand } from '@/features/trade-scenes/lib/lot-box-parts'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'

const H = LOT.wall.height
const T = LOT.wall.thickness

function fromPadToSidewalk(x0: number, x1: number, zStart: number, thickness: number, raise = 0): BoxSpec[] {
  return padToFront(lotHeightAt, GRADE.padEnd, LOT.front, x0, x1, zStart, thickness, raise)
}

const DRIVE = { x0: GARAGE.x0 + 0.15, x1: GARAGE.x1 - 0.15 }
const JOINT = 0.03
// The walk starts at the stoop's front edge; a raised home's steps run out over its first stretch.
const STOOP_Z = HOUSE.halfDepth + FRONT_STOOP.depth

export function lotBoxes(): LotBoxes {
  // The cap rides on the wall, so together they stay inside the 42 in limit.
  const lowWallBody = LOT.frontFence - LOT.wall.capHeight
  const blockWalls: BoxSpec[] = [
    run(LOT.left, LOT.back, LOT.left, LOT.gateZ, H, T),
    run(LOT.right, LOT.back, LOT.right, LOT.gateZ, H, T),
    run(LOT.left, LOT.back, LOT.right, LOT.back, H, T),
    ...fromPadToSidewalk(LOT.left - T / 2, LOT.left + T / 2, LOT.gateZ, lowWallBody),
  ]
  const wallCaps: BoxSpec[] = [
    ...capsOf(blockWalls.slice(0, 3), { height: LOT.wall.capHeight, width: LOT.wall.capWidth }),
    ...fromPadToSidewalk(LOT.left - LOT.wall.capWidth / 2, LOT.left + LOT.wall.capWidth / 2, LOT.gateZ, LOT.wall.capHeight, lowWallBody),
  ]

  const railLeft = -HOUSE.halfLength - LOT.left
  const railRight = LOT.right - GARAGE.x1
  const fenceRails: BoxSpec[] = [
    { size: [railLeft, 0.09, 0.04], position: [(LOT.left - HOUSE.halfLength) / 2, H - 0.08, LOT.gateZ - 0.03] },
    { size: [railLeft, 0.09, 0.04], position: [(LOT.left - HOUSE.halfLength) / 2, 0.3, LOT.gateZ - 0.03] },
    { size: [railRight, 0.09, 0.04], position: [(LOT.right + GARAGE.x1) / 2, H - 0.08, LOT.gateZ - 0.03] },
  ]

  const street = streetBand(LOT.front, GRADE)
  const concrete: BoxSpec[] = [
    ...fromPadToSidewalk(DRIVE.x0, DRIVE.x1, GARAGE.z1, SLAB),
    { size: [DRIVE.x1 - DRIVE.x0 + 1.2, SLAB, STREET_Z.curb + GRADE.curb - LOT.front], position: [(DRIVE.x0 + DRIVE.x1) / 2, GRADE.walk + SLAB / 2, (LOT.front + STREET_Z.curb + GRADE.curb) / 2] },
    ...fromPadToSidewalk(WALK.x0, WALK.x1, STOOP_Z, SLAB),
    ...street.concrete,
  ]

  const concreteJoints: BoxSpec[] = [
    { size: [DRIVE.x1 - DRIVE.x0, 0.004, JOINT], position: [(DRIVE.x0 + DRIVE.x1) / 2, SLAB + 0.002, GRADE.padEnd - 0.4] },
    ...[0.33, 0.66].map((t) => {
      const z = GRADE.padEnd + (LOT.front - GRADE.padEnd) * t
      return { size: [DRIVE.x1 - DRIVE.x0, 0.004, JOINT] as const, position: [(DRIVE.x0 + DRIVE.x1) / 2, lotHeightAt(z) + SLAB + 0.004, z] as const }
    }),
    ...Array.from({ length: 120 }, (_, i) => ({
      size: [JOINT, 0.004, STREET_BAND.sidewalk] as const,
      position: [-STREET_SPAN + i * 1.5, GRADE.walk + SLAB + 0.002, (STREET_Z.sidewalk[0] + STREET_Z.sidewalk[1]) / 2] as const,
    })),
  ]

  const mulch: BoxSpec[] = MULCH_BEDS.map(bed => ({
    size: [bed.x1 - bed.x0, 0.03, bed.z1 - bed.z0] as const,
    position: [(bed.x0 + bed.x1) / 2, 0.015, (bed.z0 + bed.z1) / 2] as const,
  }))

  return {
    blockWalls,
    wallCaps,
    fenceBoards: [
      ...boards(LOT.left + T / 2, -HOUSE.halfLength, LOT.gateZ, H),
      ...boards(GARAGE.x1, LOT.right - T / 2, LOT.gateZ, H),
    ],
    fenceRails,
    concrete,
    concreteJoints,
    asphalt: street.asphalt,
    mulch,
  }
}

export const LOT_BOXES: LotBoxes = lotBoxes()
