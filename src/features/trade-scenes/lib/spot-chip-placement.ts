import type { SceneVisibleArea } from '@/features/trade-scenes/types'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

export interface SpotChipFree {
  left: number
  right: number
  top: number
  bottom: number
}

export interface SpotChipPlacement {
  side: 'right' | 'left' | 'below'
  left: number
  top: number
  width: number
  maxHeight: number
  lifted: boolean
}

interface SpotChipFreeInput {
  stage: { width: number, height: number }
  area: SceneVisibleArea
  railShown: boolean
  portrait: boolean
}

interface SpotChipPlacementInput {
  point: { x: number, y: number }
  free: SpotChipFree
  widest: number
  foldedHeight: number | null
  current: SpotChipPlacement | null
}

// A bound pair can cross on a narrow stage; the lower bound is the one that holds.
function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi))
}

// The visible area is what the camera frames, so it leaves out what stands small on the stage over the pins: the systems rail
// along the bottom and the quick summary in the top-left corner. Each reserves the band across its edge here, from the same
// numbers that place it, so the chip never slides under either. The summary hides only under an open card, which reserves
// more than it.
export function spotChipFree({ stage, area, railShown, portrait }: SpotChipFreeInput): SpotChipFree {
  const { margin } = SCENE_LAYOUT.spotChip
  const { railBottom, railHeight } = SCENE_LAYOUT.controls
  const summary = SCENE_LAYOUT.summary.top + SCENE_LAYOUT.summary.height
  const rail = railShown ? railBottom[portrait ? 'portrait' : 'wide'] + railHeight : 0
  return {
    left: area.left + margin,
    right: stage.width - area.right - margin,
    top: Math.max(area.top, summary) + margin,
    bottom: stage.height - Math.max(area.bottom, rail) - margin,
  }
}

// Pinned once: a held placement keeps its side, corner and top, and only the first quick edit that needs more room lifts it.
export function spotChipPlacement({ point, free, widest, foldedHeight, current }: SpotChipPlacementInput): SpotChipPlacement {
  const { gap, nameRowHalf } = SCENE_LAYOUT.spotChip
  const width = Math.min(widest, free.right - free.left)
  const side = current !== null
    ? current.side
    : point.x + gap + width <= free.right ? 'right' : point.x - gap - width >= free.left ? 'left' : 'below'
  const left = current !== null
    ? current.left
    : side === 'right' ? point.x + gap : side === 'left' ? point.x - gap - width : clamp(point.x - width / 2, free.left, free.right - width)
  const pinnedTop = current !== null
    ? current.top
    : clamp((side === 'below' ? point.y + gap : point.y - nameRowHalf), free.top, free.bottom - 2 * nameRowHalf)
  const top = foldedHeight === null ? pinnedTop : Math.max(free.top, Math.min(pinnedTop, free.bottom - foldedHeight))
  return { side, left, top, width, maxHeight: free.bottom - top, lifted: top !== pinnedTop }
}

export function spotChipLine(
  point: { x: number, y: number },
  placement: SpotChipPlacement,
  chip: { height: number },
): { from: { x: number, y: number }, to: { x: number, y: number } } {
  const { markRadius, lineInset } = SCENE_LAYOUT.spotChip
  if (placement.side === 'below') {
    const x = clamp(point.x, placement.left + lineInset, placement.left + placement.width - lineInset)
    return { from: { x: point.x, y: point.y + markRadius }, to: { x, y: placement.top } }
  }
  const y = clamp(point.y, placement.top + lineInset, placement.top + chip.height - lineInset)
  return placement.side === 'right'
    ? { from: { x: point.x + markRadius, y: point.y }, to: { x: placement.left, y } }
    : { from: { x: point.x - markRadius, y: point.y }, to: { x: placement.left + placement.width, y } }
}
