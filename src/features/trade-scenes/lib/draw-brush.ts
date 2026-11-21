import type { DrawPick, EditorTool, FenceBrush, GroundBrush } from '@/features/trade-scenes/lib/create-layout-editor'
import type { FenceKindId, GroundLayer, GroundMaterialId } from '@/features/trade-scenes/types'

import { DRAW_ERASE } from '@/features/trade-scenes/constants/draw-pick'
import { FENCE_KINDS_BY_LAYER, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { GROUND_BASE, GROUND_MATERIALS_BY_LAYER, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'

// The pick is kept across a flip of the view, so the other layer may not offer it: its first offer stands in, and a
// stroke never writes a value its layer does not take.
export function drawPickFor<T extends string>(pick: T | typeof DRAW_ERASE, offered: readonly T[]): T | typeof DRAW_ERASE {
  if (pick === DRAW_ERASE) {
    return pick
  }
  return offered.find(id => id === pick) ?? offered[0]
}

// A stroke writes only the layer the scene shows; the other layer is left as it is.
export function groundBrushFor(pick: GroundMaterialId | typeof DRAW_ERASE, view: GroundLayer): GroundBrush {
  return view === 'existing'
    ? { existing: pick === DRAW_ERASE ? GROUND_BASE : pick, proposed: null }
    : { existing: null, proposed: pick === DRAW_ERASE ? PROPOSED_KEEP : pick }
}

export function fenceBrushFor(pick: FenceKindId | typeof DRAW_ERASE, view: GroundLayer): FenceBrush {
  return view === 'existing'
    ? { existing: pick === DRAW_ERASE ? FENCE_NONE : pick, proposed: null }
    : { existing: null, proposed: pick === DRAW_ERASE ? PROPOSED_KEEP : pick }
}

// What the draw bar offers for a tool in the view shown. The bar lists it, and a stroke and its preview read the pick
// through it, so all three name the same thing.
export function drawOffer(tool: 'ground', view: GroundLayer): readonly GroundMaterialId[]
export function drawOffer(tool: 'fence', view: GroundLayer): readonly FenceKindId[]
export function drawOffer(tool: EditorTool, view: GroundLayer): readonly (GroundMaterialId | FenceKindId)[] {
  return tool === 'ground' ? GROUND_MATERIALS_BY_LAYER[view] : FENCE_KINDS_BY_LAYER[view]
}

// The brush a stroke writes and its preview shows.
export function groundStrokeBrush(pick: DrawPick['ground'], view: GroundLayer): GroundBrush {
  return groundBrushFor(drawPickFor(pick, drawOffer('ground', view)), view)
}

export function fenceStrokeBrush(pick: DrawPick['fence'], view: GroundLayer): FenceBrush {
  return fenceBrushFor(drawPickFor(pick, drawOffer('fence', view)), view)
}
