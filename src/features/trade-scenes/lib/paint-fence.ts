import type { FenceAxis, FenceMap, LineRange, LotLayout } from '@/features/trade-scenes/types'
import { fenceGridOf } from '@/features/trade-scenes/lib/fence-cells'
import { paintList, paintTiles } from '@/features/trade-scenes/lib/paint-tiles'

type Grid = Pick<LotLayout, 'cols' | 'rows'>

// Each axis map is a tile grid of its own, so a range is a one-line rectangle and the tile painters' same-instance rule carries over.
function withAxis(map: FenceMap, axis: FenceAxis, next: Uint8Array): FenceMap {
  return next === map[axis] ? map : { ...map, [axis]: next }
}

export function paintFenceCells(map: FenceMap, lot: Grid, range: LineRange, value: number, mask?: FenceMap): FenceMap {
  const { cells, lines } = fenceGridOf(lot, range.axis)
  const rect = { c0: range.from, r0: range.line, cols: range.to - range.from, rows: 1 }
  return withAxis(map, range.axis, paintTiles(map[range.axis], cells, lines, rect, value, mask?.[range.axis]))
}

export function paintFenceList(map: FenceMap, axis: FenceAxis, indices: readonly number[], value: number, mask?: FenceMap): FenceMap {
  return withAxis(map, axis, paintList(map[axis], indices, value, mask?.[axis]))
}
