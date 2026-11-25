import type { FenceAxis, FenceMap, LotLayout, Mass } from '@/features/trade-scenes/types'

type Grid = Pick<LotLayout, 'cols' | 'rows'>

export function fenceMapSizes(lot: Grid): { across: number, along: number } {
  return { across: (lot.rows + 1) * lot.cols, along: (lot.cols + 1) * lot.rows }
}

export function fenceGridOf(lot: Grid, axis: FenceAxis): { cells: number, lines: number } {
  return axis === 'across' ? { cells: lot.cols, lines: lot.rows + 1 } : { cells: lot.rows, lines: lot.cols + 1 }
}

export function emptyFenceMap(lot: Grid): FenceMap {
  const sizes = fenceMapSizes(lot)
  return { across: new Uint8Array(sizes.across), along: new Uint8Array(sizes.along) }
}

export function fenceCellIndex(lot: Grid, axis: FenceAxis, line: number, cell: number): number {
  return line * fenceGridOf(lot, axis).cells + cell
}

// -1 for a side that lies off the lot, so a cell on a lot line has one tile.
export function fenceCellTiles(lot: Grid, axis: FenceAxis, line: number, cell: number): readonly [number, number] {
  const tile = (c: number, r: number) => (c < 0 || c >= lot.cols || r < 0 || r >= lot.rows ? -1 : r * lot.cols + c)
  return axis === 'across' ? [tile(cell, line - 1), tile(cell, line)] : [tile(line - 1, cell), tile(line, cell)]
}

// A cell with a mass on both sides is inside the house, so no fence can stand there; a face keeps open ground on one side.
export function fenceCellMask(lot: Grid, mask: Uint8Array): FenceMap {
  const axisMask = (axis: FenceAxis): Uint8Array => {
    const { cells, lines } = fenceGridOf(lot, axis)
    const out = new Uint8Array(cells * lines)
    for (let line = 0; line < lines; line++) {
      for (let cell = 0; cell < cells; cell++) {
        const [a, b] = fenceCellTiles(lot, axis, line, cell)
        if (a >= 0 && b >= 0 && mask[a] === 1 && mask[b] === 1) {
          out[line * cells + cell] = 1
        }
      }
    }
    return out
  }
  return { across: axisMask('across'), along: axisMask('along') }
}

// Anything here builds no taller than the front yard cap. An across line on the face stands before the house; an along cell is a row, and the face row already runs beside the house.
export function isFrontYardCell(main: Mass, axis: FenceAxis, line: number, cell: number): boolean {
  return axis === 'across' ? line <= main.r0 : cell < main.r0
}
