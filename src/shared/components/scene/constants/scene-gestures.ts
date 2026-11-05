import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

export const SCENE_GESTURES = {
  tapMs: 300,
  doubleMs: 300,
  doubleSlopPx: 35,
  // Touch shares the roof and part tap slop so a press never counts as a tap to one and a move to the other.
  pressTravelPx: { touch: SCENE_MOTION.tapSlopPx, mouse: 4 },
  tapRingMs: 600,
  // A transparent surface at or above this opacity stops a double-tap's ray, so glass the eye still reads as a surface is
  // looked at; only a near-clear fade lets the ray through to what is behind it.
  doubleTapStopOpacity: 0.3,
  wheel: {
    streamGapMs: 400,
    decideMs: 40,
    mouseNotch: 4.000244140625,
    trackpadSmall: 4,
    trackpadCadence: 200,
    // Browsers send a trackpad pinch as ctrl-wheel deltas of about −100·ln(scale), so this follows the fingers.
    zoomPerDelta: 0.01,
    // OrbitControls' default wheel step, 0.95 per notch.
    zoomStepMax: -Math.log(0.95),
  },
} as const
