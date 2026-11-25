import type { LotLayout, LotRegion } from '@/features/trade-scenes/types'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { groundWearAt } from '@/features/trade-scenes/lib/ground-wear-at'
import { regionRings } from '@/features/trade-scenes/lib/region-rings'

function inRegion(lot: LotLayout, mask: Uint8Array, i: number): boolean {
  return lot.existing[i] !== 0 && mask[i] !== 1
}

function sameRegion(lot: LotLayout, yards: Int8Array, a: number, b: number): boolean {
  const { appearance } = lot
  return lot.existing[a] === lot.existing[b] && lot.proposed[a] === lot.proposed[b] && lot.wear[a] === lot.wear[b]
    && appearance.existing[a] === appearance.existing[b] && appearance.proposed[a] === appearance.proposed[b] && yards[a] === yards[b]
}

// The seed is claimed unchecked: callers pass one that is already in a region.
function component(lot: LotLayout, mask: Uint8Array, yards: Int8Array, seed: number, claimed: Uint8Array): number[] {
  const { cols, rows } = lot
  const found = [seed]
  claimed[seed] = 1
  for (let n = 0; n < found.length; n++) {
    const i = found[n]
    const c = i % cols
    const r = Math.floor(i / cols)
    for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
      const j = nr * cols + nc
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !claimed[j] && inRegion(lot, mask, j) && sameRegion(lot, yards, i, j)) {
        claimed[j] = 1
        found.push(j)
      }
    }
  }
  return found
}

export function lotRegions(lot: LotLayout, mask: Uint8Array, yards: Int8Array): readonly LotRegion[] {
  const { cols } = lot
  const claimed = new Uint8Array(cols * lot.rows)
  const regions: LotRegion[] = []
  for (let seed = 0; seed < claimed.length; seed++) {
    if (claimed[seed] || !inRegion(lot, mask, seed)) {
      continue
    }
    const tiles = component(lot, mask, yards, seed, claimed)
    let [c0, r0, c1, r1] = [cols, lot.rows, 0, 0]
    for (const i of tiles) {
      const c = i % cols
      const r = Math.floor(i / cols)
      c0 = Math.min(c0, c)
      r0 = Math.min(r0, r)
      c1 = Math.max(c1, c + 1)
      r1 = Math.max(r1, r + 1)
    }
    const existing = groundMaterialAt(lot.existing[seed])
    const wear = groundWearAt(lot.wear[seed])
    const appearanceExisting = lot.appearance.existing[seed]
    const yard = YARD_IDS[yards[seed]]
    const base = lot.bases[yard]
    regions.push({
      id: `${seed}`,
      existing,
      proposed: groundMaterialAt(lot.proposed[seed]),
      wear,
      appearanceExisting,
      appearanceProposed: lot.appearance.proposed[seed],
      yard,
      base: existing === base.material && wear === base.wear && appearanceExisting === base.appearance,
      tiles: tiles.length,
      rings: regionRings(new Set(tiles), cols),
      bbox: { c0, r0, cols: c1 - c0, rows: r1 - r0 },
    })
  }
  return regions.sort((a, b) => a.bbox.r0 - b.bbox.r0 || a.bbox.c0 - b.bbox.c0)
}

const componentMaps = new WeakMap<readonly LotRegion[], Int32Array>()

// Tile index to the position of its region in `regions`, -1 for none; built once per regions instance.
function componentMap(regions: readonly LotRegion[], lot: LotLayout, mask: Uint8Array, yards: Int8Array): Int32Array {
  const cached = componentMaps.get(regions)
  if (cached) {
    return cached
  }
  const map = new Int32Array(lot.cols * lot.rows).fill(-1)
  const claimed = new Uint8Array(map.length)
  regions.forEach((region, n) => {
    for (const i of component(lot, mask, yards, Number(region.id), claimed)) {
      map[i] = n
    }
  })
  componentMaps.set(regions, map)
  return map
}

export function regionAt(regions: readonly LotRegion[], lot: LotLayout, mask: Uint8Array, yards: Int8Array, col: number, row: number): LotRegion | null {
  if (col < 0 || col >= lot.cols || row < 0 || row >= lot.rows) {
    return null
  }
  return regions[componentMap(regions, lot, mask, yards)[row * lot.cols + col]] ?? null
}

export function regionTileIndices(regions: readonly LotRegion[], lot: LotLayout, mask: Uint8Array, yards: Int8Array, id: string): readonly number[] {
  const n = regions.findIndex(region => region.id === id)
  if (n === -1) {
    return []
  }
  const indices: number[] = []
  componentMap(regions, lot, mask, yards).forEach((owner, i) => {
    if (owner === n) {
      indices.push(i)
    }
  })
  return indices
}

// Base ground the build keeps is the yard itself, not a thing in it, so it is never selected.
export function isSelectableRegion(region: LotRegion): boolean {
  return !region.base || region.proposed !== null
}

export function regionAreaM2(region: LotRegion, tile: number): number {
  return region.tiles * tile * tile
}
