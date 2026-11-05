import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

const { zoomPerDelta, zoomStepMax } = SCENE_GESTURES.wheel

// What the camera's distance is multiplied by. A pinch sends many small deltas, a mouse notch one large one, so the
// rate is set for the pinch and the cap holds a notch to OrbitControls' own step.
export function wheelZoomScale(deltaY: number): number {
  return Math.exp(Math.min(Math.max(deltaY * zoomPerDelta, -zoomStepMax), zoomStepMax))
}
