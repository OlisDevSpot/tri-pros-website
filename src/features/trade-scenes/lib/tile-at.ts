import type { GridVertex, LotLayout, LotOrigin, TileRect, WorldRect } from '@/features/trade-scenes/types'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'

// Bounds are tested in metres, as the lot's bounds are built, so a point on the far edge never floors into the last tile.
export function tileAt(origin: LotOrigin, lot: LotLayout, x: number, z: number): readonly [col: number, row: number] | null {
  const { originX, frontZ, tile } = origin
  if (x < originX || x >= originX + metresOf(lot.cols, tile) || z > frontZ || z <= frontZ - metresOf(lot.rows, tile)) {
    return null
  }
  return [Math.min(lot.cols - 1, Math.floor((x - originX) / tile)), Math.min(lot.rows - 1, Math.floor((frontZ - z) / tile))]
}

// A press up to half a tile past the lot still snaps onto its lot line, so a fence can be traced along the very corner.
export function vertexAt(origin: LotOrigin, lot: Pick<LotLayout, 'cols' | 'rows'>, x: number, z: number): GridVertex | null {
  const { originX, frontZ, tile } = origin
  const col = (x - originX) / tile
  const row = (frontZ - z) / tile
  if (col < -0.5 || col > lot.cols + 0.5 || row < -0.5 || row > lot.rows + 0.5) {
    return null
  }
  return [Math.min(lot.cols, Math.max(0, Math.round(col))), Math.min(lot.rows, Math.max(0, Math.round(row)))]
}

export function worldRectOf(origin: LotOrigin, rect: TileRect): WorldRect {
  const { originX, frontZ, tile } = origin
  return {
    x0: originX + metresOf(rect.c0, tile),
    x1: originX + metresOf(rect.c0 + rect.cols, tile),
    z0: frontZ - metresOf(rect.r0 + rect.rows, tile),
    z1: frontZ - metresOf(rect.r0, tile),
  }
}
