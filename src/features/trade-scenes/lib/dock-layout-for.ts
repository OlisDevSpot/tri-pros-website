import type { DockFold, StageShape } from '@/features/trade-scenes/types'

import { DOCK_FOLDS } from '@/features/trade-scenes/constants/scene-dock'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { sceneVisibleAreaFor } from '@/features/trade-scenes/lib/scene-visible-area-for'

interface DockLayoutInput {
  shape: StageShape
  stage: { width: number, height: number }
  // A close-up is open.
  zoomed: boolean
}

// Top to bottom: the home view, Thermal and the weather, with the two dividers only while nothing is folded.
export function dockHeightFor(fold: DockFold): number {
  const { tile, divider, spacing, padding, border } = SCENE_LAYOUT.dock
  const tiles = { none: 1 + 1 + 4, weather: 1 + 1 + 1 }[fold]
  const dividers = fold === 'none' ? 2 : 0
  const items = tiles + dividers
  return tiles * tile + dividers * divider + (items - 1) * spacing + 2 * (padding + border)
}

// The dock's region: `dock.gap` below the stage's top, and above what covers the stage's bottom: the band the bottom group
// stands in, or on portrait a close-up card standing on it. On portrait, off a close-up, it also keeps the room of the
// shortcut-keys button standing on the band, whether the button shows or not, so a first key press never moves the dock;
// up close the button steps away.
export function dockRegionFor(shape: StageShape, stage: { width: number, height: number }, zoomed: boolean): { top: number, bottom: number } {
  const { dock, keysButton } = SCENE_LAYOUT
  const covered = sceneVisibleAreaFor({ shape, ...stage, zoomed, focusCardBottom: null }).bottom
  const keysRoom = shape === 'portrait' && !zoomed ? keysButton.gap + keysButton.size + keysButton.spacing : 0
  return { top: dock.gap, bottom: covered + keysRoom }
}

// On portrait the weather always folds; beside the scene it folds only where the stage is too short, as an iPad inside the
// browser's bars is.
export function dockLayoutFor({ shape, stage, zoomed }: DockLayoutInput): DockFold {
  const region = dockRegionFor(shape, stage, zoomed)
  const room = stage.height - region.top - region.bottom
  const folds = shape === 'portrait' ? DOCK_FOLDS.filter(next => next !== 'none') : DOCK_FOLDS
  return folds.find(next => dockHeightFor(next) <= room) ?? DOCK_FOLDS[DOCK_FOLDS.length - 1]
}
