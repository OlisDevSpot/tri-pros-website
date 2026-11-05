import { HOME_GHOST_OPACITY } from '@/features/trade-scenes/constants/home-geometry'

export const LOOK_INSIDE = {
  ghostOpacity: HOME_GHOST_OPACITY,
  // A tapped system part stays whole; the rest of its system fades back to this so it reads on its own. A working number.
  dimmedOpacity: 0.25,
  // Pins crowd a closed roof, so they show once it is this far open. A working number.
  pinsFromPeel: 0.2,
} as const
