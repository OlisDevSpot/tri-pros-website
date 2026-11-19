import type { FenceAxis, FenceLine, FenceMap, LineRange, LotLayout, LotSide, PropertyLayout } from '@/features/trade-scenes/types'
import { fenceCellIndex, fenceGridOf, isFrontYardCell } from '@/features/trade-scenes/lib/fence-cells'
import { fenceKindAt } from '@/features/trade-scenes/lib/fence-kind-at'

type Grid = Pick<LotLayout, 'cols' | 'rows'>

const AXES: readonly FenceAxis[] = ['across', 'along']

export function perimeterSideOf(lot: Grid, range: LineRange): LotSide | null {
  if (range.line === 0) {
    return range.axis === 'across' ? 'front' : 'left'
  }
  if (range.line === fenceGridOf(lot, range.axis).lines - 1) {
    return range.axis === 'across' ? 'back' : 'right'
  }
  return null
}

export function lotFenceLines(layout: PropertyLayout, fenceMask: FenceMap): readonly FenceLine[] {
  const { lot } = layout
  const main = layout.house.masses.find(mass => mass.role === 'main')
  if (!main) {
    throw new Error('A property layout has one main mass.')
  }
  const lines: FenceLine[] = []
  for (const axis of AXES) {
    const { cells, lines: lineCount } = fenceGridOf(lot, axis)
    const pairAt = (line: number, cell: number): readonly [number, number] | null => {
      const i = fenceCellIndex(lot, axis, line, cell)
      const pair = [lot.fence.existing[axis][i], lot.fence.proposed[axis][i]] as const
      return fenceMask[axis][i] === 0 && (pair[0] !== 0 || pair[1] !== 0) ? pair : null
    }
    for (let line = 0; line < lineCount; line++) {
      for (let from = 0; from < cells;) {
        const pair = pairAt(line, from)
        if (!pair) {
          from++
          continue
        }
        let to = from + 1
        let front = isFrontYardCell(main, axis, line, from)
        for (; to < cells; to++) {
          const next = pairAt(line, to)
          if (!next || next[0] !== pair[0] || next[1] !== pair[1]) {
            break
          }
          front &&= isFrontYardCell(main, axis, line, to)
        }
        const range = { axis, line, from, to }
        lines.push({
          ...range,
          id: `${axis}-${line}-${from}`,
          existing: fenceKindAt(pair[0]),
          proposed: fenceKindAt(pair[1]),
          perimeter: perimeterSideOf(lot, range) !== null,
          frontYard: front,
        })
        from = to
      }
    }
  }
  return lines
}

export function fenceLineAt(lines: readonly FenceLine[], axis: FenceAxis, line: number, cell: number): FenceLine | null {
  return lines.find(l => l.axis === axis && l.line === line && cell >= l.from && cell < l.to) ?? null
}

export function fenceLineCells(range: LineRange, lot: Grid): readonly number[] {
  return Array.from({ length: range.to - range.from }, (_, n) => fenceCellIndex(lot, range.axis, range.line, range.from + n))
}

export function fenceLengthM(range: LineRange, tile: number): number {
  return (range.to - range.from) * tile
}
