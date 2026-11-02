import type { WallSlice } from '@/features/trade-scenes/lib/wall-boxes'
import type { HouseWall, WallOpening } from '@/features/trade-scenes/types'

export interface WallRect {
  along: readonly [number, number]
  height: readonly [number, number]
}

export interface WallSkinOutline {
  outer: WallRect
  holes: WallRect[]
}

// A wall slice as one outline with a hole per opening inside it, in the wall's own terms (along its run, and up).
export function wallSkinOutline(wall: HouseWall, slice: WallSlice, openings: readonly WallOpening[] = wall.openings): WallSkinOutline {
  const holes = openings
    .filter(opening => opening.along - opening.width / 2 >= slice.from && opening.along + opening.width / 2 <= slice.to)
    .map((opening): WallRect => ({
      along: [opening.along - opening.width / 2, opening.along + opening.width / 2],
      height: [slice.floorY + opening.sill, slice.floorY + opening.head],
    }))
  // A hole on the outline's edge is a notch, which the triangulation of a shape with holes cannot take.
  for (const hole of holes) {
    if (hole.along[0] <= slice.from || hole.along[1] >= slice.to || hole.height[0] <= slice.bottom || hole.height[1] >= slice.top) {
      throw new Error(`wallSkinOutline: the opening at ${hole.along[0]}…${hole.along[1]} reaches the slice's edge`)
    }
  }
  return { outer: { along: [slice.from, slice.to], height: [slice.bottom, slice.top] }, holes }
}
