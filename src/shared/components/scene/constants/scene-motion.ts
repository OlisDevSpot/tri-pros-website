import { BRAND_EASE } from '@/shared/constants/motion'

// The 3D side eases exponentially and the DOM side on the brand bezier. At this damping a value covers ~95% of its
// way in `transition.duration`, so a figure counting down and a ribbon narrowing read as one gesture.
export const SCENE_MOTION = {
  damping: 6,
  settled: 0.0005,
  maxFrameSeconds: 0.1,
  restFrameSeconds: 1 / 60,
  transition: { duration: 0.5, ease: BRAND_EASE },
  // A drag that orbits the camera ends in a click too; a press that moved this far is an orbit, not a tap.
  tapSlopPx: 6,
} as const
