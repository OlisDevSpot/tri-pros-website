import type { SceneVisibleArea, StageShape } from '@/features/trade-scenes/types'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

interface SceneVisibleAreaInput {
  shape: StageShape
  width: number
  height: number
  zoomed: boolean
  // The system card's measured bottom, in stage px, while a system holds the camera; else null.
  focusCardBottom: number | null
}

// A stage not yet measured has nothing on it to keep clear of.
const NOTHING_COVERED: SceneVisibleArea = { left: 0, right: 0, bottom: 0, top: 0 }

// Modals are passing layers over the scene, so only what stays put covers it: the dock, the band the bottom group stands
// in, a close-up card, and the system card beside the system it frames, or above it where the stage is too narrow.
export function sceneVisibleAreaFor({ shape, width, height, zoomed, focusCardBottom }: SceneVisibleAreaInput): SceneVisibleArea {
  if (width === 0 || height === 0) {
    return NOTHING_COVERED
  }
  const { closeUp, controls, dock, systemCard } = SCENE_LAYOUT
  // The dock stands at the right edge in every shape.
  const dockRight = dock.width + dock.gap
  if (shape === 'portrait') {
    const band = controls.modalBottom.portrait
    return {
      left: 0,
      right: dockRight,
      bottom: zoomed ? band + Math.round(height * closeUp.portrait.share) + closeUp.portrait.gap : band,
      top: focusCardBottom === null ? 0 : focusCardBottom + systemCard.visibleGap,
    }
  }
  if (shape === 'narrow') {
    return {
      left: zoomed ? closeUp.gap + closeUp.narrowWidth : 0,
      right: dockRight,
      bottom: controls.modalBottom.wide,
      top: focusCardBottom === null ? 0 : focusCardBottom + systemCard.visibleGap,
    }
  }
  return {
    left: zoomed ? closeUp.gap + closeUp.width : 0,
    right: focusCardBottom === null ? dockRight : dockRight + systemCard.dockGap + systemCard.width,
    bottom: controls.modalBottom.wide,
    top: 0,
  }
}
