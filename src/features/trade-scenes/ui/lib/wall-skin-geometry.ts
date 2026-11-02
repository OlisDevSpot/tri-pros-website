import type { BufferGeometry } from 'three'
import type { WallSlice } from '@/features/trade-scenes/lib/wall-boxes'
import type { WallRect } from '@/features/trade-scenes/lib/wall-skin-outline'
import type { HouseWall, WallOpening } from '@/features/trade-scenes/types'

import { ExtrudeGeometry, Path, Shape } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { wallSkinOutline } from '@/features/trade-scenes/lib/wall-skin-outline'

export interface WallSkinSpec {
  wall: HouseWall
  slice: WallSlice
  openings?: readonly WallOpening[]
}

function traceRect<T extends Path>(path: T, rect: WallRect): T {
  path.moveTo(rect.along[0], rect.height[0])
  path.lineTo(rect.along[1], rect.height[0])
  path.lineTo(rect.along[1], rect.height[1])
  path.lineTo(rect.along[0], rect.height[1])
  path.closePath()
  return path
}

// One solid per wall, with a hole per opening. Boxes butted round the openings keep their end faces inside the wall, and
// every joint shows as a hairline where those faces meet the face in front.
export function wallSkinGeometry(wall: HouseWall, slice: WallSlice, openings: readonly WallOpening[] = wall.openings): BufferGeometry {
  const { outer, holes } = wallSkinOutline(wall, slice, openings)
  const shape = traceRect(new Shape(), outer)
  shape.holes = holes.map(hole => traceRect(new Path(), hole))
  const geometry = new ExtrudeGeometry(shape, { depth: slice.thickness, bevelEnabled: false })
  geometry.translate(0, 0, -slice.thickness / 2)
  const across = wall.line + wall.outward * slice.offset
  if (wall.run === 'z') {
    // A quarter turn the other way from the gables' carries the shape's x to world +z, so a run along z keeps its direction.
    geometry.rotateY(-Math.PI / 2)
    geometry.translate(across, 0, 0)
  }
  else {
    geometry.translate(0, 0, across)
  }
  return geometry
}

// Every wall of one colour in one draw call, as the merged boxes are.
export function wallSkinsGeometry(skins: readonly WallSkinSpec[]): BufferGeometry {
  const parts = skins.map(({ wall, slice, openings }) => wallSkinGeometry(wall, slice, openings))
  const merged = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  if (!merged) {
    throw new Error('wallSkinsGeometry: the walls could not be merged into one geometry')
  }
  return merged
}
