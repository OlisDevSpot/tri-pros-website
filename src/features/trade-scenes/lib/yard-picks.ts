import type { FenceAxis, FenceKindId, FenceLine, GroundLayer, GroundMaterialId, GroundSystemId, LotLayout, PropertyLayout, YardBase, YardId } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import { FENCE_KINDS, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { DEFAULT_GROUND_WEAR, GROUND_BASE, GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_WEAR_INDEX, GROUND_WEAR_NONE, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { applyFenceStroke, applyStroke } from '@/features/trade-scenes/lib/create-layout-editor'
import { fenceCellIndex, fenceCellTiles, fenceGridOf } from '@/features/trade-scenes/lib/fence-cells'
import { fenceKindAt } from '@/features/trade-scenes/lib/fence-kind-at'
import { canonicalAppearance } from '@/features/trade-scenes/lib/ground-appearance'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { groundWearAt } from '@/features/trade-scenes/lib/ground-wear-at'
import { fenceLineCells } from '@/features/trade-scenes/lib/lot-fences'
import { yardLotLineCells, yardMap, yardTileIndices } from '@/features/trade-scenes/lib/yards'

type Mixed = 'mixed'

const FENCE_AXES: readonly FenceAxis[] = ['across', 'along']

const wearIndexOf = (wear: Wear | null) => wear === null ? GROUND_WEAR_NONE : GROUND_WEAR_INDEX[wear]

function oneOrMixed<T>(values: readonly T[]): T | Mixed {
  return values.every(v => v === values[0]) ? values[0] : 'mixed'
}

export function yardSystemTiles(lot: LotLayout, yards: Int8Array, yard: YardId, system: GroundSystemId): readonly number[] {
  return yardTileIndices(yards, yard).filter((tile) => {
    const material = groundMaterialAt(lot.existing[tile])
    return material !== null && GROUND_MATERIALS[material].system === system
  })
}

export function yardGroundToday(lot: LotLayout, yards: Int8Array, yard: YardId, system: GroundSystemId): { material: GroundMaterialId | Mixed, wear: Wear | Mixed | null, appearance: number | Mixed } | null {
  const tiles = yardSystemTiles(lot, yards, yard, system)
  if (tiles.length === 0) {
    return null
  }
  const material = oneOrMixed(tiles.map(tile => groundMaterialAt(lot.existing[tile])!))
  const worn = tiles.filter(tile => lot.wear[tile] !== GROUND_WEAR_NONE).map(tile => groundWearAt(lot.wear[tile]))
  return { material, wear: worn.length === 0 ? null : oneOrMixed(worn), appearance: oneOrMixed(tiles.map(tile => lot.appearance.existing[tile])) }
}

export function yardGroundBuild(lot: LotLayout, yards: Int8Array, yard: YardId, system: GroundSystemId): { material: GroundMaterialId | Mixed, appearance: number | Mixed } | null {
  const tiles = yardSystemTiles(lot, yards, yard, system)
  if (tiles.every(tile => lot.proposed[tile] === PROPOSED_KEEP)) {
    return null
  }
  const value = oneOrMixed(tiles.map(tile => lot.proposed[tile]))
  // Not every tile keeps, so one shared value is a material.
  return { material: value === 'mixed' ? value : groundMaterialAt(value)!, appearance: oneOrMixed(tiles.map(tile => lot.appearance.proposed[tile])) }
}

interface GroundPatch { material?: GroundMaterialId, wear?: Wear, appearance?: number }

// A new material starts at its first look unless the patch names one.
function baseWith(base: YardBase, patch: GroundPatch): YardBase {
  const material = patch.material ?? base.material
  return {
    material,
    wear: GROUND_MATERIALS[material].wears ? patch.wear ?? base.wear ?? DEFAULT_GROUND_WEAR : null,
    appearance: canonicalAppearance(material, patch.appearance ?? (material === base.material ? base.appearance : 0)) ?? 0,
  }
}

// An appearance is an index into one material's list, so over a mix of materials it names nothing.
function appearanceFor<P extends { material?: unknown, appearance?: number }>(patch: P, current: { material: unknown } | null): P {
  return patch.material === undefined && current?.material === 'mixed' ? { ...patch, appearance: undefined } : patch
}

export function setYardGround(layout: PropertyLayout, yard: YardId, system: GroundSystemId, asked: GroundPatch): PropertyLayout {
  const { lot } = layout
  const yards = yardMap(layout)
  if (yardTileIndices(yards, yard).length === 0) {
    return layout
  }
  const patch = appearanceFor(asked, yardGroundToday(lot, yards, yard, system))
  const tiles = yardSystemTiles(lot, yards, yard, system)
  const byWear = new Map<number, number[]>()
  for (const tile of tiles) {
    byWear.set(lot.wear[tile], [...byWear.get(lot.wear[tile]) ?? [], tile])
  }
  let next = layout
  for (const [level, group] of byWear) {
    next = applyStroke(next, group, { existing: patch.material ?? null, proposed: null, wear: patch.wear ?? groundWearAt(level) ?? undefined, appearanceExisting: patch.appearance })
  }
  const base = lot.bases[yard]
  if (GROUND_MATERIALS[base.material].system !== system) {
    return next
  }
  return withBase(next, yard, baseWith(base, patch))
}

export function setYardBase(layout: PropertyLayout, yard: YardId, patch: GroundPatch): PropertyLayout {
  const { lot } = layout
  const old = lot.bases[yard]
  const base = baseWith(old, patch)
  const yardTiles = yardTileIndices(yardMap(layout), yard)
  if (yardTiles.length === 0) {
    return layout
  }
  const tiles = yardTiles.filter(tile => lot.existing[tile] === GROUND_MATERIAL_INDEX[old.material] && lot.wear[tile] === wearIndexOf(old.wear) && lot.appearance.existing[tile] === old.appearance)
  const painted = applyStroke(layout, tiles, { existing: base.material, proposed: null, wear: base.wear ?? undefined, appearanceExisting: base.appearance })
  return withBase(painted, yard, base)
}

export function setYardBuild(layout: PropertyLayout, yard: YardId, system: GroundSystemId, asked: { material?: GroundMaterialId | typeof PROPOSED_KEEP, appearance?: number }): PropertyLayout {
  const yards = yardMap(layout)
  const patch = appearanceFor(asked, yardGroundBuild(layout.lot, yards, yard, system))
  return applyStroke(layout, yardSystemTiles(layout.lot, yards, yard, system), { existing: null, proposed: patch.material ?? null, appearanceProposed: patch.appearance })
}

function withBase(layout: PropertyLayout, yard: YardId, base: YardBase): PropertyLayout {
  const old = layout.lot.bases[yard]
  if (old.material === base.material && old.wear === base.wear && old.appearance === base.appearance) {
    return layout
  }
  return { ...layout, lot: { ...layout.lot, bases: { ...layout.lot.bases, [yard]: base } }, source: 'edited' }
}

interface LotLineCells { axis: FenceAxis, indices: readonly number[] }

const isGate = (value: number) => value !== 0 && FENCE_KINDS[fenceKindAt(value)!].gate

function standingCells(lot: LotLayout, cells: readonly LotLineCells[]): LotLineCells[] {
  return cells
    .map(({ axis, indices }) => ({ axis, indices: indices.filter(i => lot.fence.existing[axis][i] !== 0 && !isGate(lot.fence.existing[axis][i])) }))
    .filter(entry => entry.indices.length > 0)
}

export function yardFence(layout: PropertyLayout, yards: Int8Array, yard: YardId, layer: GroundLayer): FenceKindId | Mixed | null {
  const { lot } = layout
  const standing = standingCells(lot, yardLotLineCells(lot, yards, yard))
  const values = standing.flatMap(({ axis, indices }) => indices.map(i => lot.fence[layer][axis][i]))
  if (values.length === 0 || (layer === 'proposed' && values.every(v => v === PROPOSED_KEEP))) {
    return null
  }
  const value = oneOrMixed(values)
  return value === 'mixed' ? value : fenceKindAt(value)
}

export function setYardFence(layout: PropertyLayout, yard: YardId, layer: GroundLayer, kind: FenceKindId | typeof PROPOSED_KEEP): PropertyLayout {
  const { lot } = layout
  const cells = yardLotLineCells(lot, yardMap(layout), yard)
  let targets = standingCells(lot, cells)
  if (targets.length === 0 && layer === 'existing') {
    targets = cells
      .map(({ axis, indices }) => ({ axis, indices: indices.filter(i => !isGate(lot.fence.existing[axis][i])) }))
      .filter(entry => entry.indices.length > 0)
  }
  let next = layout
  for (const target of targets) {
    next = applyFenceStroke(next, target, layer === 'existing' ? { existing: kind, proposed: null } : { existing: null, proposed: kind })
  }
  return next
}

export function yardBuildChanges(layout: PropertyLayout, yards: Int8Array, yard: YardId): boolean {
  const { lot } = layout
  const index = YARD_IDS.indexOf(yard)
  if (yardTileIndices(yards, yard).some(tile => lot.proposed[tile] !== PROPOSED_KEEP)) {
    return true
  }
  return FENCE_AXES.some((axis) => {
    const { cells, lines } = fenceGridOf(lot, axis)
    for (let line = 0; line < lines; line++) {
      for (let cell = 0; cell < cells; cell++) {
        if (lot.fence.proposed[axis][fenceCellIndex(lot, axis, line, cell)] !== PROPOSED_KEEP && fenceCellTiles(lot, axis, line, cell).some(tile => tile >= 0 && yards[tile] === index)) {
          return true
        }
      }
    }
    return false
  })
}

export function removeRegion(layout: PropertyLayout, tiles: readonly number[]): PropertyLayout {
  return applyStroke(layout, tiles, { existing: GROUND_BASE, proposed: PROPOSED_KEEP })
}

export function removeFenceLine(layout: PropertyLayout, line: FenceLine): PropertyLayout {
  return applyFenceStroke(layout, { axis: line.axis, indices: fenceLineCells(line, layout.lot) }, { existing: FENCE_NONE, proposed: PROPOSED_KEEP })
}
