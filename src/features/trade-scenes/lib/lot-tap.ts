import type { EditorSelection } from '@/features/trade-scenes/lib/create-layout-editor'
import type { FenceLine, LotLayout, LotOrigin, ResolvedLayout, YardId } from '@/features/trade-scenes/types'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { fenceCellTiles } from '@/features/trade-scenes/lib/fence-cells'
import { isSelectableRegion, regionAt } from '@/features/trade-scenes/lib/lot-regions'

export interface LotHit { tile: readonly [col: number, row: number] | null, fenceId: string | null }

// Base ground the build keeps is the yard itself, so it opens the yard with nothing selected; anything drawn on it, or changed by the
// build, is a thing to select.
export function lotTapTarget(hit: LotHit, resolved: Pick<ResolvedLayout, 'layout' | 'mask' | 'yards' | 'regions' | 'fences'>): { yard: YardId, selected: EditorSelection | null } | null {
  if (!hit.tile) {
    return null
  }
  const { lot } = resolved.layout
  const [col, row] = hit.tile
  const index = col >= 0 && col < lot.cols && row >= 0 && row < lot.rows ? resolved.yards[row * lot.cols + col] : -1
  if (index < 0) {
    return null
  }
  const yard = YARD_IDS[index]
  if (hit.fenceId !== null) {
    return { yard, selected: { type: 'fence', id: hit.fenceId } }
  }
  const region = regionAt(resolved.regions, lot, resolved.mask, resolved.yards, col, row)
  return { yard, selected: region && isSelectableRegion(region) ? { type: 'region', id: region.id } : null }
}

// The tile on the hit's side of the fence opens its yard. A lot line has open ground on one side only, and a house face on
// one side of an inside line, so the other side answers when the near one is in no yard.
export function fenceTapTile(origin: LotOrigin, lot: Pick<LotLayout, 'cols' | 'rows'>, yards: Int8Array, line: FenceLine, x: number, z: number): readonly [col: number, row: number] | null {
  const col = (x - origin.originX) / origin.tile
  const row = (origin.frontZ - z) / origin.tile
  const [along, across] = line.axis === 'across' ? [col, row] : [row, col]
  const cell = Math.min(line.to - 1, Math.max(line.from, Math.floor(along)))
  const [before, after] = fenceCellTiles(lot, line.axis, line.line, cell)
  const tile = (across < line.line ? [before, after] : [after, before]).find(i => i >= 0 && yards[i] >= 0)
  return tile === undefined ? null : [tile % lot.cols, Math.floor(tile / lot.cols)]
}
