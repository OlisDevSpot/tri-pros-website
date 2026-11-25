import type { FenceAxis, FenceMap, Mass, PropertyLayout, RoomStandIn, TileRect } from '@/features/trade-scenes/types'
import { fenceGridOf } from '@/features/trade-scenes/lib/fence-cells'

function sourceOf(index: number, count: number, scale: number): number {
  return Math.min(count - 1, Math.floor((index + 0.5) / scale))
}

function resample(map: Uint8Array, cols: number, rows: number, nextCols: number, nextRows: number, scale: number): Uint8Array {
  const next = new Uint8Array(nextCols * nextRows)
  for (let r = 0; r < nextRows; r++) {
    const sourceRow = sourceOf(r, rows, scale)
    for (let c = 0; c < nextCols; c++) {
      const sourceCol = sourceOf(c, cols, scale)
      next[r * nextCols + c] = map[sourceRow * cols + sourceCol]
    }
  }
  return next
}

export function retilePropertyLayout(layout: PropertyLayout, tile: number): PropertyLayout {
  if (tile === layout.tile) {
    return layout
  }
  const scale = layout.tile / tile
  const cols = Math.max(1, Math.round(layout.lot.cols * scale))
  const rows = Math.max(1, Math.round(layout.lot.rows * scale))
  const scaled = (n: number, max: number) => Math.min(max, Math.round(n * scale))
  // Scaling both boundaries keeps abutting shapes abutting; rounding a size on its own would not.
  const rect = <T extends TileRect>(shape: T): T => {
    const c0 = scaled(shape.c0, cols - 1)
    const r0 = scaled(shape.r0, rows - 1)
    return {
      ...shape,
      c0,
      r0,
      cols: Math.max(1, scaled(shape.c0 + shape.cols, cols) - c0),
      rows: Math.max(1, scaled(shape.r0 + shape.rows, rows) - r0),
    }
  }
  // Lines scatter forward as a rectangle's ends do: sampling them backwards would draw each line on two fine lines.
  // Where a coarser grid folds two lines into one, a drawn cell beats an empty one and the later line the earlier.
  const fenceAxis = (map: Uint8Array, axis: FenceAxis): Uint8Array => {
    const from = fenceGridOf(layout.lot, axis)
    const to = fenceGridOf({ cols, rows }, axis)
    const next = new Uint8Array(to.cells * to.lines)
    for (let line = 0; line < from.lines; line++) {
      const target = scaled(line, to.lines - 1) * to.cells
      for (let cell = 0; cell < to.cells; cell++) {
        const value = map[line * from.cells + sourceOf(cell, from.cells, scale)]
        if (value !== 0) {
          next[target + cell] = value
        }
      }
    }
    return next
  }
  const fenceMap = (map: FenceMap): FenceMap => ({ across: fenceAxis(map.across, 'across'), along: fenceAxis(map.along, 'along') })

  return {
    ...layout,
    tile,
    lot: {
      ...layout.lot,
      cols,
      rows,
      existing: resample(layout.lot.existing, layout.lot.cols, layout.lot.rows, cols, rows, scale),
      proposed: resample(layout.lot.proposed, layout.lot.cols, layout.lot.rows, cols, rows, scale),
      wear: resample(layout.lot.wear, layout.lot.cols, layout.lot.rows, cols, rows, scale),
      appearance: {
        existing: resample(layout.lot.appearance.existing, layout.lot.cols, layout.lot.rows, cols, rows, scale),
        proposed: resample(layout.lot.appearance.proposed, layout.lot.cols, layout.lot.rows, cols, rows, scale),
      },
      fence: { existing: fenceMap(layout.lot.fence.existing), proposed: fenceMap(layout.lot.fence.proposed) },
      grade: { ...layout.lot.grade, padEndRow: scaled(layout.lot.grade.padEndRow, rows) },
    },
    house: {
      ...layout.house,
      masses: layout.house.masses.map((mass): Mass => rect(mass)),
      rooms: layout.house.rooms.map((room): RoomStandIn => ({ ...room, span: rect(room.span) })),
    },
  }
}
