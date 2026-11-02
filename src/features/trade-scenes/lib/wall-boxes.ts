import type { BoxSpec, HouseWall, WallOpening } from '@/features/trade-scenes/types'

export interface WallSlice {
  from: number
  to: number
  /** Centre of the slice across the wall, from the wall's centre line toward the outside. */
  offset: number
  thickness: number
  bottom: number
  top: number
  floorY: number
}

// One box in the wall's own terms (a span along its run, a height, a depth across it), placed in the world.
export function wallBox(wall: HouseWall, along: readonly [number, number], height: readonly [number, number], offset: number, thickness: number): BoxSpec {
  const length = along[1] - along[0]
  const centre = (along[0] + along[1]) / 2
  const across = wall.line + wall.outward * offset
  const y = (height[0] + height[1]) / 2
  return wall.run === 'x'
    ? { size: [length, height[1] - height[0], thickness], position: [centre, y, across] }
    : { size: [thickness, height[1] - height[0], length], position: [across, y, centre] }
}

// A wall run cut into the boxes around its openings: full-height piers between openings, and a box under and over each.
export function wallBoxes(wall: HouseWall, slice: WallSlice, openings: readonly WallOpening[] = wall.openings): BoxSpec[] {
  const inside = openings
    .filter(opening => opening.along - opening.width / 2 >= slice.from && opening.along + opening.width / 2 <= slice.to)
    .sort((a, b) => a.along - b.along)
  const piece = (along: readonly [number, number], height: readonly [number, number]) => wallBox(wall, along, height, slice.offset, slice.thickness)
  const boxes: BoxSpec[] = []
  let cursor = slice.from
  for (const opening of inside) {
    const left = opening.along - opening.width / 2
    const right = opening.along + opening.width / 2
    if (left > cursor) {
      boxes.push(piece([cursor, left], [slice.bottom, slice.top]))
    }
    const sill = slice.floorY + opening.sill
    const head = slice.floorY + opening.head
    if (sill > slice.bottom) {
      boxes.push(piece([left, right], [slice.bottom, sill]))
    }
    if (head < slice.top) {
      boxes.push(piece([left, right], [head, slice.top]))
    }
    cursor = right
  }
  if (cursor < slice.to) {
    boxes.push(piece([cursor, slice.to], [slice.bottom, slice.top]))
  }
  return boxes
}
