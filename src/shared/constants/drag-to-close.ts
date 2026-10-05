export const DRAG_TO_CLOSE = {
  // Below this the gesture is still a tap, so a press on a row or button inside the sheet lands.
  startPx: 6,
  closeDistanceRatio: 0.25,
  closeVelocityPxPerMs: 0.5,
} as const
