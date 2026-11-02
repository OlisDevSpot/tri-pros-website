import type { BoxSpec, LotBoxes } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, GRADE, LOT, STREET_Z, WALK } from '@/features/trade-scenes/constants/home-lot'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'

const SIDEWALK = STREET_Z.sidewalk[1] - STREET_Z.sidewalk[0]
const SPAN = 90
const H = LOT.wall.height
const T = LOT.wall.thickness

function run(x0: number, z0: number, x1: number, z1: number, height: number, thickness: number): BoxSpec {
  const length = Math.hypot(x1 - x0, z1 - z0)
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0)
  return {
    size: alongX ? [length, height, thickness] : [thickness, height, length],
    position: [(x0 + x1) / 2, height / 2, (z0 + z1) / 2],
  }
}

// A slab laid on the grade between two depths, tilted to follow it.
function onGrade(x0: number, x1: number, z0: number, z1: number, thickness: number, raise = 0): BoxSpec {
  const y0 = lotHeightAt(z0)
  const y1 = lotHeightAt(z1)
  const length = z1 - z0
  return {
    size: [x1 - x0, thickness, Math.hypot(length, y1 - y0)],
    position: [(x0 + x1) / 2, (y0 + y1) / 2 + thickness / 2 + raise, (z0 + z1) / 2],
    rotation: [Math.atan2(y0 - y1, length), 0, 0],
  }
}

// A flat run over the pad, then a sloped one down the front yard: what anything laid from the house to the sidewalk needs.
function fromPadToSidewalk(x0: number, x1: number, zStart: number, thickness: number, raise = 0): BoxSpec[] {
  return [onGrade(x0, x1, zStart, GRADE.padEnd, thickness, raise), onGrade(x0, x1, GRADE.padEnd, LOT.front, thickness, raise)]
}

// Vertical cedar boards with a hairline gap: the side-yard returns and their gates.
function boards(x0: number, x1: number, z: number, height: number): BoxSpec[] {
  const width = 0.14
  const count = Math.floor((x1 - x0) / (width + 0.012))
  return Array.from({ length: count }, (_, i) => ({
    size: [width, height, 0.025] as const,
    position: [x0 + (i + 0.5) * (width + 0.012), height / 2, z] as const,
  }))
}

const DRIVE = { x0: GARAGE.x0 + 0.15, x1: GARAGE.x1 - 0.15 }
const JOINT = 0.03
const SLAB = 0.04
const STOOP_Z = HOUSE.halfDepth + 0.9

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
    ...blockWalls.slice(0, 3).map(({ size, position }) => ({
      size: [size[0] > size[2] ? size[0] + 0.04 : LOT.wall.capWidth, LOT.wall.capHeight, size[2] > size[0] ? size[2] + 0.04 : LOT.wall.capWidth] as const,
      position: [position[0], position[1] + size[1] / 2 + LOT.wall.capHeight / 2, position[2]] as const,
    })),
    ...fromPadToSidewalk(LOT.left - LOT.wall.capWidth / 2, LOT.left + LOT.wall.capWidth / 2, LOT.gateZ, LOT.wall.capHeight, lowWallBody),
  ]

  const railLeft = -HOUSE.halfLength - LOT.left
  const railRight = LOT.right - GARAGE.x1
  const fenceRails: BoxSpec[] = [
    { size: [railLeft, 0.09, 0.04], position: [(LOT.left - HOUSE.halfLength) / 2, H - 0.08, LOT.gateZ - 0.03] },
    { size: [railLeft, 0.09, 0.04], position: [(LOT.left - HOUSE.halfLength) / 2, 0.3, LOT.gateZ - 0.03] },
    { size: [railRight, 0.09, 0.04], position: [(LOT.right + GARAGE.x1) / 2, H - 0.08, LOT.gateZ - 0.03] },
  ]

  const curbTop = GRADE.curb + SLAB
  const concrete: BoxSpec[] = [
    ...fromPadToSidewalk(DRIVE.x0, DRIVE.x1, GARAGE.z1, SLAB),
    { size: [DRIVE.x1 - DRIVE.x0 + 1.2, SLAB, STREET_Z.curb + GRADE.curb - LOT.front], position: [(DRIVE.x0 + DRIVE.x1) / 2, GRADE.walk + SLAB / 2, (LOT.front + STREET_Z.curb + GRADE.curb) / 2] },
    // The stoop stands taller than the walk so a slab home still steps up onto it.
    ...fromPadToSidewalk(WALK.x0, WALK.x1, STOOP_Z, SLAB),
    { size: [1.9, 0.14, 0.9], position: [-0.6, 0.07, HOUSE.halfDepth + 0.45] },
    { size: [SPAN * 2, SLAB, SIDEWALK], position: [0, GRADE.walk + SLAB / 2, (STREET_Z.sidewalk[0] + STREET_Z.sidewalk[1]) / 2] },
    { size: [SPAN * 2, SLAB, SIDEWALK], position: [0, GRADE.walk + SLAB / 2, (STREET_Z.farSidewalk[0] + STREET_Z.farSidewalk[1]) / 2] },
    { size: [SPAN * 2, curbTop, GRADE.curb], position: [0, GRADE.street + curbTop / 2, STREET_Z.curb + GRADE.curb / 2] },
    { size: [SPAN * 2, curbTop, GRADE.curb], position: [0, GRADE.street + curbTop / 2, STREET_Z.farCurb - GRADE.curb / 2] },
    { size: [SPAN * 2, 0.02, 0.46], position: [0, GRADE.street + 0.012, STREET_Z.curb + GRADE.curb + 0.23] },
    { size: [SPAN * 2, 0.02, 0.46], position: [0, GRADE.street + 0.012, STREET_Z.farCurb - GRADE.curb - 0.23] },
  ]

  const concreteJoints: BoxSpec[] = [
    { size: [DRIVE.x1 - DRIVE.x0, 0.004, JOINT], position: [(DRIVE.x0 + DRIVE.x1) / 2, SLAB + 0.002, GRADE.padEnd - 0.4] },
    ...[0.33, 0.66].map((t) => {
      const z = GRADE.padEnd + (LOT.front - GRADE.padEnd) * t
      return { size: [DRIVE.x1 - DRIVE.x0, 0.004, JOINT] as const, position: [(DRIVE.x0 + DRIVE.x1) / 2, lotHeightAt(z) + SLAB + 0.004, z] as const }
    }),
    ...Array.from({ length: 120 }, (_, i) => ({
      size: [JOINT, 0.004, SIDEWALK] as const,
      position: [-SPAN + i * 1.5, GRADE.walk + SLAB + 0.002, (STREET_Z.sidewalk[0] + STREET_Z.sidewalk[1]) / 2] as const,
    })),
  ]

  const asphalt: BoxSpec[] = [
    { size: [SPAN * 2, 0.02, STREET_Z.farCurb - STREET_Z.curb - 2 * GRADE.curb], position: [0, GRADE.street + 0.002, (STREET_Z.curb + STREET_Z.farCurb) / 2] },
  ]

  const mulch: BoxSpec[] = [
    { size: [4.6, 0.03, 1.3], position: [-3.75, 0.015, HOUSE.halfDepth + 0.85] },
    { size: [4.4, 0.03, 1.3], position: [2.6, 0.015, HOUSE.halfDepth + 0.85] },
    { size: [1.5, 0.03, GRADE.padEnd - LOT.gateZ], position: [LOT.left + 0.85, 0.015, (LOT.gateZ + GRADE.padEnd) / 2] },
  ]

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
    asphalt,
    mulch,
  }
}

export const LOT_BOXES: LotBoxes = lotBoxes()
