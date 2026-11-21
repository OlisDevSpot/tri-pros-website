import type { LineRange, LotLayout, PropertyLayout, RoomStandIn, TileRect } from '@/features/trade-scenes/types'
import { FENCE_KIND_INDEX } from '@/features/trade-scenes/constants/fence-kinds'
import { DEFAULT_GROUND_WEAR, GROUND_MATERIAL_INDEX, GROUND_WEAR_INDEX } from '@/features/trade-scenes/constants/ground-materials'
import { HOUSE, PARTITIONS_X } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, GRADE, LOT, MULCH_BEDS, WALK } from '@/features/trade-scenes/constants/home-lot'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { emptyFenceMap, fenceCellMask } from '@/features/trade-scenes/lib/fence-cells'
import { paintFenceCells } from '@/features/trade-scenes/lib/paint-fence'
import { paintTiles } from '@/features/trade-scenes/lib/paint-tiles'
import { tilesOf } from '@/features/trade-scenes/lib/tile-units'

export function defaultLayout(tile: number): PropertyLayout {
  const cols = tilesOf(LOT.right - LOT.left, tile)
  const rows = tilesOf(LOT.front - LOT.back, tile)

  // Ends exclusive, so two rectangles that share a metre edge share a tile edge.
  const rect = (x0: number, x1: number, zNear: number, zFar: number): TileRect => {
    const c0 = tilesOf(x0 - LOT.left, tile)
    const r0 = tilesOf(LOT.front - zNear, tile)
    return { c0, r0, cols: tilesOf(x1 - LOT.left, tile) - c0, rows: tilesOf(LOT.front - zFar, tile) - r0 }
  }

  const main = { ...rect(-HOUSE.halfLength, HOUSE.halfLength, HOUSE.halfDepth, -HOUSE.halfDepth), id: 'main', stories: 1 as const, role: 'main' as const }
  const garage = { ...rect(GARAGE.x0, GARAGE.x1, GARAGE.z1, GARAGE.z0), id: 'garage', stories: 1 as const, role: 'garage' as const }

  const inner = HOUSE.halfLength - HOUSE.wallThickness
  const room = (kind: RoomStandIn['kind'], x0: number, x1: number): RoomStandIn => {
    const c0 = tilesOf(x0 - LOT.left, tile)
    return { massId: 'main', kind, span: { c0, r0: main.r0, cols: tilesOf(x1 - LOT.left, tile) - c0, rows: main.rows }, story: 1 }
  }

  const index = GROUND_MATERIAL_INDEX
  let existing: Uint8Array = new Uint8Array(cols * rows).fill(index.sod)
  existing = paintTiles(existing, cols, rows, rect(GARAGE.x0 + 0.15, GARAGE.x1 - 0.15, LOT.front, GARAGE.z1), index.concrete)
  existing = paintTiles(existing, cols, rows, rect(WALK.x0, WALK.x1, LOT.front, HOUSE.halfDepth + 0.9), index.concrete)
  for (const bed of MULCH_BEDS) {
    existing = paintTiles(existing, cols, rows, rect(bed.x0, bed.x1, bed.z1, bed.z0), index.mulch)
  }

  const sideYardRow = tilesOf(LOT.front - LOT.gateZ, tile)

  const grid = { cols, rows }
  // No layout exists yet for massMask to read.
  const houseMask = [main, garage].reduce<Uint8Array>((mask, mass) => paintTiles(mask, cols, rows, mass, 1), new Uint8Array(cols * rows))
  const fenceKind = FENCE_KIND_INDEX
  const drawn: readonly (readonly [LineRange, number])[] = [
    [{ axis: 'across', line: rows, from: 0, to: cols }, fenceKind.blockWall],
    [{ axis: 'along', line: 0, from: sideYardRow, to: rows }, fenceKind.blockWall],
    [{ axis: 'along', line: cols, from: sideYardRow, to: rows }, fenceKind.blockWall],
    [{ axis: 'along', line: 0, from: 0, to: sideYardRow }, fenceKind.lowWall],
    [{ axis: 'across', line: sideYardRow, from: 0, to: main.c0 }, fenceKind.woodFence],
    [{ axis: 'across', line: sideYardRow, from: garage.c0 + garage.cols, to: cols }, fenceKind.woodFence],
  ]
  const cellMask = fenceCellMask(grid, houseMask)
  const existingFence = drawn.reduce((map, [range, kind]) => paintFenceCells(map, grid, range, kind, cellMask), emptyFenceMap(grid))

  return {
    version: 1,
    tile,
    lot: {
      cols,
      rows,
      existing,
      proposed: new Uint8Array(cols * rows),
      wear: new Uint8Array(cols * rows).fill(GROUND_WEAR_INDEX[DEFAULT_GROUND_WEAR]),
      appearance: { existing: new Uint8Array(cols * rows), proposed: new Uint8Array(cols * rows) },
      bases: Object.fromEntries(YARD_IDS.map(yard => [yard, { material: 'sod', wear: DEFAULT_GROUND_WEAR, appearance: 0 }])) as LotLayout['bases'],
      fence: { existing: existingFence, proposed: emptyFenceMap(grid) },
      grade: { padEndRow: tilesOf(LOT.front - GRADE.padEnd, tile), walkDrop: -GRADE.walk, streetDrop: -GRADE.street },
    },
    house: {
      masses: [main, garage],
      roof: 'gable',
      foundation: 'raised',
      rooms: [
        room('bed', -inner, PARTITIONS_X[0]),
        room('living', PARTITIONS_X[0], PARTITIONS_X[1]),
        room('kitchen', PARTITIONS_X[1], inner),
      ],
    },
    source: 'default',
  }
}
