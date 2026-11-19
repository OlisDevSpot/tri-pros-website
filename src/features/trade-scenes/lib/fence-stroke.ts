import type { LineLock } from '@/features/trade-scenes/lib/create-layout-editor'
import type { FenceLine, GridVertex, LineRange, LotLayout, LotOrigin } from '@/features/trade-scenes/types'
import { fenceLineAt } from '@/features/trade-scenes/lib/lot-fences'

type Grid = Pick<LotLayout, 'cols' | 'rows'>

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value))

// A diagonal drag is one straight length on the axis it moved most along, never two lengths meeting at a corner.
export function lineRangeBetween(a: GridVertex, b: GridVertex): LineRange | null {
  if (a[0] === b[0] && a[1] === b[1]) {
    return null
  }
  if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) {
    return { axis: 'across', line: a[1], from: Math.min(a[0], b[0]), to: Math.max(a[0], b[0]) }
  }
  return { axis: 'along', line: a[0], from: Math.min(a[1], b[1]), to: Math.max(a[1], b[1]) }
}

// A hit on a wall's face sits off the wall's own line, and near a crossing grid line that line can be the nearer one.
// So both lines in reach are tried, nearest first, and the first that carries a fence wins; across wins a tie, so a tap
// on a grid vertex finds the same line every time.
export function fenceLineNear(origin: LotOrigin, lot: Grid, lines: readonly FenceLine[], x: number, z: number, within: number): FenceLine | null {
  const { originX, frontZ, tile } = origin
  const col = (x - originX) / tile
  const row = (frontZ - z) / tile
  const acrossLine = clamp(Math.round(row), lot.rows)
  const alongLine = clamp(Math.round(col), lot.cols)
  const candidates = [
    { axis: 'across', line: acrossLine, cell: clamp(Math.floor(col), lot.cols - 1), off: Math.abs(row - acrossLine) * tile },
    { axis: 'along', line: alongLine, cell: clamp(Math.floor(row), lot.rows - 1), off: Math.abs(col - alongLine) * tile },
  ] as const
  for (const { axis, line, cell } of [...candidates].filter(c => c.off <= within).sort((a, b) => a.off - b.off)) {
    const found = fenceLineAt(lines, axis, line, cell)
    if (found) {
      return found
    }
  }
  return null
}

export function vertexAlong(origin: LotOrigin, lot: Grid, lock: LineLock, x: number, z: number): GridVertex {
  const { originX, frontZ, tile } = origin
  const col = (x - originX) / tile
  const row = (frontZ - z) / tile
  return lock.axis === 'across' ? [clamp(Math.round(col), lot.cols), lock.line] : [lock.line, clamp(Math.round(row), lot.rows)]
}

// The four lot lines are tried; a point is in reach of one within `withinTiles` either side of it and that far past
// either end of it. The nearest wins and the front or back line (across) wins a tie, so a corner press is stable.
export function magnetVertex(origin: LotOrigin, lot: Grid, x: number, z: number, withinTiles: number): { vertex: GridVertex, lock: LineLock } | null {
  const { originX, frontZ, tile } = origin
  const col = (x - originX) / tile
  const row = (frontZ - z) / tile
  const lines: { lock: LineLock, off: number, along: number, length: number }[] = [
    { lock: { axis: 'across', line: 0 }, off: Math.abs(row), along: col, length: lot.cols },
    { lock: { axis: 'across', line: lot.rows }, off: Math.abs(row - lot.rows), along: col, length: lot.cols },
    { lock: { axis: 'along', line: 0 }, off: Math.abs(col), along: row, length: lot.rows },
    { lock: { axis: 'along', line: lot.cols }, off: Math.abs(col - lot.cols), along: row, length: lot.rows },
  ]
  const reach = lines.filter(l => l.off <= withinTiles && l.along >= -withinTiles && l.along <= l.length + withinTiles)
  const nearest = reach.reduce<(typeof reach)[number] | null>((best, l) => best === null || l.off < best.off ? l : best, null)
  return nearest && { vertex: vertexAlong(origin, lot, nearest.lock, x, z), lock: nearest.lock }
}
