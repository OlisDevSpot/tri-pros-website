import type { AcTons } from '@/shared/modules/construction/core/constants/enums'

import { EQUIPMENT } from '@/features/trade-scenes/constants/home-geometry'

// Hand-tuned working numbers, set by eye against the scene: a multiplier on the drawn unit, with an unset size at 1.
export const AC_SCALE = { 3: 0.82, 4: 1, 5: 1.22 } as const satisfies Record<AcTons, number>

export const PACKAGE_UNIT = {
  // Metres at scale 1: [along the ridge, height, depth].
  size: [1.35, 0.55, 0.85] as const,
  curbHeight: 0.12,
  // The gable's curb stands on the far slope, which Partly open never takes off, right over the plenum its air comes down
  // into; the flat roof's sits over the kept back half. Working numbers, set by eye.
  gableX: EQUIPMENT.plenum.position[0],
  gableZ: EQUIPMENT.plenum.position[2],
  flat: { x: -1.6, z: -1.3 },
  // The bare trunk on the plenum's footprint that the drop comes down into, and the drop's [along the ridge, depth]. Working
  // numbers, set by eye.
  trunk: { bottom: EQUIPMENT.plenum.position[1] - 0.23, top: EQUIPMENT.plenum.position[1] - 0.01 },
  drop: [0.46, 0.36] as const,
  fan: { radius: 0.25, blades: 5, rimWidth: 0.025 },
  colors: { case: '#d9d6cf', louvre: '#a9a59d', curb: '#8f8c86', grille: '#3b3a38', blade: '#5f5b56' },
} as const
