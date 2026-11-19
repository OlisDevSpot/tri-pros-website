import type { FenceAxis, LotLayout, PropertyLayout, TileRect, YardId } from '@/features/trade-scenes/types'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { fenceCellIndex, fenceCellTiles, fenceGridOf } from '@/features/trade-scenes/lib/fence-cells'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'

export function yardOfTile(main: TileRect, col: number, row: number): YardId {
  if (row < main.r0) {
    return 'front-yard'
  }
  if (row >= main.r0 + main.rows) {
    return 'back-yard'
  }
  return col < main.c0 ? 'left-side-yard' : 'right-side-yard'
}

export function yardMap(layout: PropertyLayout): Int8Array {
  const { cols, rows } = layout.lot
  const main = layout.house.masses.find(mass => mass.role === 'main')
  if (!main) {
    throw new Error('A property layout has one main mass.')
  }
  const mask = massMask(layout)
  const yards = new Int8Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = row * cols + col
      yards[tile] = mask[tile] === 1 ? -1 : YARD_IDS.indexOf(yardOfTile(main, col, row))
    }
  }
  return yards
}

export function presentYards(yards: Int8Array): readonly YardId[] {
  return YARD_IDS.filter((_, i) => yards.includes(i))
}

export function yardTileIndices(yards: Int8Array, yard: YardId): readonly number[] {
  const index = YARD_IDS.indexOf(yard)
  const tiles: number[] = []
  yards.forEach((value, tile) => {
    if (value === index) {
      tiles.push(tile)
    }
  })
  return tiles
}

// A cell on a lot line has one tile on the lot, so no house can sit across it and the fence mask never covers it.
export function yardLotLineCells(lot: Pick<LotLayout, 'cols' | 'rows'>, yards: Int8Array, yard: YardId): readonly { axis: FenceAxis, indices: readonly number[] }[] {
  const index = YARD_IDS.indexOf(yard)
  const axes: readonly FenceAxis[] = ['across', 'along']
  return axes
    .map((axis) => {
      const { cells, lines } = fenceGridOf(lot, axis)
      const indices: number[] = []
      for (const line of [0, lines - 1]) {
        for (let cell = 0; cell < cells; cell++) {
          const onLot = fenceCellTiles(lot, axis, line, cell).find(tile => tile >= 0)
          if (onLot !== undefined && yards[onLot] === index) {
            indices.push(fenceCellIndex(lot, axis, line, cell))
          }
        }
      }
      return { axis, indices }
    })
    .filter(entry => entry.indices.length > 0)
}
