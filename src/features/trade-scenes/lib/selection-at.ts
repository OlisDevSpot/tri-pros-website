import type { EditorSelection } from '@/features/trade-scenes/lib/create-layout-editor'
import type { FenceAxis, PropertyLayout } from '@/features/trade-scenes/types'
import { fenceCellMask } from '@/features/trade-scenes/lib/fence-cells'
import { fenceLineAt, lotFenceLines } from '@/features/trade-scenes/lib/lot-fences'
import { isSelectableRegion, lotRegions, regionAt } from '@/features/trade-scenes/lib/lot-regions'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'
import { yardMap } from '@/features/trade-scenes/lib/yards'

// A region's id is its first tile, so a repaint that merges it with an earlier neighbour renames it; the selection
// follows the tile. A region painted back to its yard's base is the yard again, and a tap there selects nothing, so
// neither does this.
export function regionSelectionAt(layout: PropertyLayout, tile: number): EditorSelection | null {
  const { lot } = layout
  const mask = massMask(layout)
  const yards = yardMap(layout)
  const region = regionAt(lotRegions(lot, mask, yards), lot, mask, yards, tile % lot.cols, Math.floor(tile / lot.cols))
  return region && isSelectableRegion(region) ? { type: 'region', id: region.id } : null
}

// A fence line's id is its first cell, so a repaint that joins it to an earlier neighbour renames it; the selection
// follows the cell. A line repainted to nothing on both layers is gone, and so is the selection.
export function fenceSelectionAt(layout: PropertyLayout, axis: FenceAxis, line: number, cell: number): EditorSelection | null {
  const lines = lotFenceLines(layout, fenceCellMask(layout.lot, massMask(layout)))
  const id = fenceLineAt(lines, axis, line, cell)?.id
  return id ? { type: 'fence', id } : null
}
