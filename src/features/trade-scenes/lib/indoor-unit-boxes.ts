import type { IndoorUnitPlacement, IndoorUnitSectionId } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'

import { CONDENSER_LINE_SET } from '@/features/trade-scenes/constants/home-details'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'

export interface IndoorUnitSection {
  id: IndoorUnitSectionId
  box: BoxSpec
}

const AIR_ORDER: readonly IndoorUnitSectionId[] = ['blower', 'furnace', 'coil', 'plenum']
// Within this of the trunk's end, the plenum stands where the runs leave and needs no trunk to reach them.
const AT_THE_RUNS = 0.05

function step(from: Vec3, toward: Vec3, by: number): Vec3 {
  return [from[0] + toward[0] * by, from[1] + toward[1] * by, from[2] + toward[2] * by]
}

function sizeAlong({ toward, section: [width, depth] }: IndoorUnitPlacement, length: number): Vec3 {
  if (toward[1] !== 0) {
    return [width, length, depth]
  }
  return toward[0] !== 0 ? [length, depth, width] : [width, depth, length]
}

// A part the system lacks closes up, so the air's path stays one unbroken line from the return to the plenum.
export function indoorUnitBoxes(placement: IndoorUnitPlacement, has: { furnace: boolean, coil: boolean }): IndoorUnitSection[] {
  const ids = AIR_ORDER.filter(id => (id !== 'furnace' || has.furnace) && (id !== 'coil' || has.coil))
  const starts = ids.map((_, index) => ids.slice(0, index).reduce((sum, id) => sum + placement.lengths[id], 0))
  return ids.map((id, index) => ({
    id,
    box: { size: sizeAlong(placement, placement.lengths[id]), position: step(placement.base, placement.toward, starts[index]! + placement.lengths[id] / 2) },
  }))
}

function sectionOf(sections: readonly IndoorUnitSection[], id: IndoorUnitSectionId): BoxSpec | null {
  return sections.find(section => section.id === id)?.box ?? null
}

// The supply's path from the plenum's far face to where the runs leave, or null when the plenum already stands there: a
// closet's plenum always, and an attic unit's once a missing section has pulled it back toward the return.
export function indoorUnitTrunk(placement: IndoorUnitPlacement, sections: readonly IndoorUnitSection[]): Vec3[] | null {
  const plenum = sectionOf(sections, 'plenum')
  const end = placement.trunk.at(-1)
  if (plenum === null || end === undefined) {
    return null
  }
  const [x, y, z] = plenum.position
  if (Math.hypot(x - end[0], y - end[1], z - end[2]) < AT_THE_RUNS) {
    return null
  }
  const half = placement.toward.reduce((sum, axis, index) => sum + Math.abs(axis) * plenum.size[index]! / 2, 0)
  return [step(plenum.position, placement.toward, half), ...placement.trunk]
}

// The lines leave the coil from the face nearest their route, wherever a missing furnace has moved the coil to, and drop to
// the condenser's own lines. Those come into the wall at a fixed height off the ground while the house stands on its floor,
// so the drop is the floor's: none on a slab, where the run along the outside already meets them.
export function indoorUnitLineSet(placement: IndoorUnitPlacement, sections: readonly IndoorUnitSection[], floorY: number): Vec3[] | null {
  const coil = sectionOf(sections, 'coil')
  const first = placement.lineSet[0]
  const last = placement.lineSet.at(-1)
  if (coil === null || first === undefined || last === undefined) {
    return null
  }
  const onCoil = (axis: 0 | 1 | 2) => Math.min(Math.max(first[axis], coil.position[axis] - coil.size[axis] / 2), coil.position[axis] + coil.size[axis] / 2)
  const entryY = CONDENSER_LINE_SET.y - (floorY - HOUSE.floorY)
  const drop: Vec3[] = Math.abs(entryY - last[1]) < 1e-6 ? [] : [[last[0], entryY, last[2]]]
  return [[onCoil(0), onCoil(1), onCoil(2)], ...placement.lineSet, ...drop]
}
