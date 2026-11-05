import type { SceneVisibleArea, StageShape } from '@/features/trade-scenes/types'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

interface SceneVisibleAreaInput {
  shape: StageShape
  width: number
  height: number
  // The system card's measured bottom, in stage px, while a system holds the camera; else null.
  focusCardBottom: number | null
}

// A stage not yet measured has nothing on it to keep clear of.
const NOTHING_COVERED: SceneVisibleArea = { left: 0, right: 0, bottom: 0, top: 0 }

// Modals are passing layers over the scene, so only what stays put covers it: the dock, the band the bottom group stands
// in, and the system card beside the system it frames, or above it where the stage is too narrow. Up close the same card
// holds the system's parts, so it covers no more.
export function sceneVisibleAreaFor({ shape, width, height, focusCardBottom }: SceneVisibleAreaInput): SceneVisibleArea {
  if (width === 0 || height === 0) {
    return NOTHING_COVERED
  }
  const { controls, dock, systemCard } = SCENE_LAYOUT
  // The dock stands at the right edge in every shape.
  const dockRight = dock.width + dock.gap
  if (shape === 'portrait') {
    return {
      left: 0,
      right: dockRight,
      bottom: controls.modalBottom.portrait,
      top: focusCardBottom === null ? 0 : focusCardBottom + systemCard.visibleGap,
    }
  }
  if (shape === 'narrow') {
    return {
      left: 0,
      right: dockRight,
      bottom: controls.modalBottom.wide,
      top: focusCardBottom === null ? 0 : focusCardBottom + systemCard.visibleGap,
    }
  }
  return {
    left: 0,
    right: focusCardBottom === null ? dockRight : dockRight + systemCard.dockGap + systemCard.width,
    bottom: controls.modalBottom.wide,
    top: 0,
  }
}
