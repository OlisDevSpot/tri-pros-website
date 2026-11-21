import type { StoreApi } from 'zustand/vanilla'
import type { DRAW_ERASE } from '@/features/trade-scenes/constants/draw-pick'
import type { FenceAxis, FenceKindId, FenceMap, GridVertex, GroundMaterialId, LineRange, LotLayout, PropertyLayout, TileRect, TradeSceneInputs, YardId } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { FENCE_KIND_INDEX, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { DEFAULT_GROUND_WEAR, GROUND_BASE, GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_WEAR_INDEX, GROUND_WEAR_NONE, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { fenceCellMask } from '@/features/trade-scenes/lib/fence-cells'
import { canonicalAppearance } from '@/features/trade-scenes/lib/ground-appearance'
import { groundMaterialAt } from '@/features/trade-scenes/lib/ground-material-at'
import { massMask } from '@/features/trade-scenes/lib/mass-mask'
import { paintFenceCells, paintFenceList } from '@/features/trade-scenes/lib/paint-fence'
import { yardMap } from '@/features/trade-scenes/lib/yards'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'

export type EditorTool = 'ground' | 'fence'
export type EditorSelection = { type: 'region', id: string } | { type: 'fence', id: string }
// A fence stroke pressed near a lot line holds that line: its drag runs along it.
export interface LineLock { axis: FenceAxis, line: number }
// A ground stroke runs between two tiles; a fence stroke between two grid vertices.
export type EditorStroke = { tool: 'ground', from: readonly [col: number, row: number], to: readonly [col: number, row: number] } | { tool: 'fence', from: GridVertex, to: GridVertex, lock: LineLock | null }

// A null layer is No change: the stroke leaves it alone. The proposed Keep paints 0, which shows the existing ground.
// Base paints each tile its own yard's base; a wear with no existing material sets the wear alone, where the ground wears.
// A tile given a new material on a layer takes the brush's appearance for that layer, or its first; an appearance with no
// material recolours the layer only where it holds a material, so ground the build keeps takes none. Every appearance is
// stored as its material reads it, so a material with one look always holds 0.
export interface GroundBrush { existing: GroundMaterialId | typeof GROUND_BASE | null, proposed: GroundMaterialId | typeof PROPOSED_KEEP | null, wear?: Wear, appearanceExisting?: number, appearanceProposed?: number }
// As the ground brush: a null layer is No change; None erases what stands today, Keep erases what the build adds.
export interface FenceBrush { existing: FenceKindId | typeof FENCE_NONE | null, proposed: FenceKindId | typeof PROPOSED_KEEP | null }
// What the draw bar holds for each tool. Kept across a flip of the view, so it is read through the offer of the layer shown.
export interface DrawPick { ground: GroundMaterialId | typeof DRAW_ERASE, fence: FenceKindId | typeof DRAW_ERASE }

export interface LayoutEditorState {
  mode: 'orbit' | 'draw'
  tool: EditorTool
  pick: DrawPick
  selected: EditorSelection | null
  stroke: EditorStroke | null
  undo: readonly PropertyLayout[]
  // The yard Areas holds on the Lot group: its card is open and its outline drawn.
  yard: YardId | null
}

const UNDO_DEPTH = 10

export function createLayoutEditor(): StoreApi<LayoutEditorState> {
  return createSceneInputs<LayoutEditorState>({ mode: 'orbit', tool: 'ground', pick: { ground: 'concrete', fence: 'woodFence' }, yard: null, selected: null, stroke: null, undo: [] })
}

function edited(layout: PropertyLayout, lot: LotLayout): PropertyLayout {
  return { ...layout, lot, source: 'edited' }
}

function targetTiles(lot: LotLayout, target: TileRect | readonly number[]): readonly number[] {
  if (!('c0' in target)) {
    return target.filter(i => i >= 0 && i < lot.cols * lot.rows)
  }
  const tiles: number[] = []
  for (let r = Math.max(0, target.r0); r < Math.min(lot.rows, target.r0 + target.rows); r++) {
    for (let c = Math.max(0, target.c0); c < Math.min(lot.cols, target.c0 + target.cols); c++) {
      tiles.push(r * lot.cols + c)
    }
  }
  return tiles
}

// Wear is left out: a colour picked on worn asphalt must come back when the asphalt is made good again.
function storedAppearance(material: number, appearance: number): number {
  const id = groundMaterialAt(material)
  return id === null ? 0 : canonicalAppearance(id, appearance) ?? 0
}

// The first change copies the map, so a map the stroke leaves alone keeps its identity for the no-change check.
function written(map: Uint8Array, original: Uint8Array, i: number, value: number): Uint8Array {
  if (map[i] === value) {
    return map
  }
  const next = map === original ? map.slice() : map
  next[i] = value
  return next
}

// The same layout back when nothing changes, so a stroke that paints nothing leaves no undo step and no URL write.
export function applyStroke(layout: PropertyLayout, target: TileRect | readonly number[], brush: GroundBrush): PropertyLayout {
  const { lot } = layout
  const mask = massMask(layout)
  const tiles = targetTiles(lot, target).filter(i => mask[i] !== 1)
  const yards = brush.existing === GROUND_BASE ? yardMap(layout) : null
  const wearIndex = (wear: Wear | null) => wear === null ? GROUND_WEAR_NONE : GROUND_WEAR_INDEX[wear]
  const build = brush.proposed === null ? null : brush.proposed === PROPOSED_KEEP ? PROPOSED_KEEP : GROUND_MATERIAL_INDEX[brush.proposed]
  let { existing, wear, proposed } = lot
  let { existing: lookToday, proposed: lookBuild } = lot.appearance
  for (const i of tiles) {
    let material = existing[i]
    let level = wear[i]
    let look = lookToday[i]
    if (brush.existing === GROUND_BASE) {
      const base = lot.bases[YARD_IDS[yards![i]]]
      material = GROUND_MATERIAL_INDEX[base.material]
      level = GROUND_MATERIALS[base.material].wears ? wearIndex(base.wear) : GROUND_WEAR_NONE
      look = storedAppearance(material, base.appearance)
    }
    else if (brush.existing !== null) {
      material = GROUND_MATERIAL_INDEX[brush.existing]
      level = GROUND_MATERIALS[brush.existing].wears ? wearIndex(brush.wear ?? DEFAULT_GROUND_WEAR) : GROUND_WEAR_NONE
      look = storedAppearance(material, brush.appearanceExisting ?? (material === existing[i] ? look : 0))
    }
    else {
      const current = groundMaterialAt(material)
      if (brush.wear !== undefined && current && GROUND_MATERIALS[current].wears) {
        level = wearIndex(brush.wear)
      }
      if (brush.appearanceExisting !== undefined && current) {
        look = storedAppearance(material, brush.appearanceExisting)
      }
    }
    let built = proposed[i]
    let builtLook = lookBuild[i]
    if (build !== null) {
      builtLook = storedAppearance(build, brush.appearanceProposed ?? (build === built ? builtLook : 0))
      built = build
    }
    else if (brush.appearanceProposed !== undefined && built !== PROPOSED_KEEP) {
      builtLook = storedAppearance(built, brush.appearanceProposed)
    }
    existing = written(existing, lot.existing, i, material)
    wear = written(wear, lot.wear, i, level)
    lookToday = written(lookToday, lot.appearance.existing, i, look)
    proposed = written(proposed, lot.proposed, i, built)
    lookBuild = written(lookBuild, lot.appearance.proposed, i, builtLook)
  }
  const appearance = lookToday === lot.appearance.existing && lookBuild === lot.appearance.proposed ? lot.appearance : { existing: lookToday, proposed: lookBuild }
  if (existing === lot.existing && wear === lot.wear && proposed === lot.proposed && appearance === lot.appearance) {
    return layout
  }
  return edited(layout, { ...lot, existing, wear, proposed, appearance })
}

// Same layout back when nothing changes. A LineRange target paints a traced length; an index list repaints a line's cells.
export function applyFenceStroke(layout: PropertyLayout, target: LineRange | { axis: FenceAxis, indices: readonly number[] }, brush: FenceBrush): PropertyLayout {
  const { lot } = layout
  const mask = fenceCellMask(lot, massMask(layout))
  const paint = (map: FenceMap, value: number) => 'indices' in target ? paintFenceList(map, target.axis, target.indices, value, mask) : paintFenceCells(map, lot, target, value, mask)
  const { fence } = lot
  const existing = brush.existing === null ? fence.existing : paint(fence.existing, brush.existing === FENCE_NONE ? FENCE_NONE : FENCE_KIND_INDEX[brush.existing])
  const proposed = brush.proposed === null ? fence.proposed : paint(fence.proposed, brush.proposed === PROPOSED_KEEP ? PROPOSED_KEEP : FENCE_KIND_INDEX[brush.proposed])
  if (existing === fence.existing && proposed === fence.proposed) {
    return layout
  }
  return edited(layout, { ...lot, fence: { existing, proposed } })
}

export function pushUndo(undo: readonly PropertyLayout[], layout: PropertyLayout): readonly PropertyLayout[] {
  return [...undo, layout].slice(-UNDO_DEPTH)
}

export function commitLayout(inputs: StoreApi<TradeSceneInputs>, editor: StoreApi<LayoutEditorState>, next: PropertyLayout): void {
  const previous = inputs.getState().layout
  if (next === previous) {
    return
  }
  editor.setState(state => ({ undo: pushUndo(state.undo, previous) }))
  inputs.setState({ layout: next })
}

// Draw mode owns the camera until it ends. A pick from the bar while drawing comes this way too.
export function startDrawing(editor: StoreApi<LayoutEditorState>, tool: 'ground', pick?: DrawPick['ground']): void
export function startDrawing(editor: StoreApi<LayoutEditorState>, tool: 'fence', pick?: DrawPick['fence']): void
export function startDrawing(editor: StoreApi<LayoutEditorState>, tool: EditorTool, pick?: DrawPick[EditorTool]): void {
  editor.setState(state => ({ mode: 'draw', tool, pick: pick === undefined ? state.pick : { ...state.pick, [tool]: pick }, selected: null, stroke: null }))
}

export function endDrawing(editor: StoreApi<LayoutEditorState>): void {
  if (editor.getState().mode === 'orbit') {
    return
  }
  editor.setState({ mode: 'orbit', stroke: null })
}

export function undoLayout(inputs: StoreApi<TradeSceneInputs>, editor: StoreApi<LayoutEditorState>): void {
  const { undo } = editor.getState()
  const previous = undo.at(-1)
  if (!previous) {
    return
  }
  // The selected thing may not stand in the layout stepped back to.
  editor.setState({ undo: undo.slice(0, -1), selected: null })
  inputs.setState({ layout: previous })
}
