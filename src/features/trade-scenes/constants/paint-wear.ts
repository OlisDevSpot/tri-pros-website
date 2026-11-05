import type { PaintWear } from '@/features/trade-scenes/types'
import type { PaintWearLevel, Wear } from '@/shared/modules/construction/core/constants/enums'

import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'

export const PAINT_WEAR_START = {
  new: { cracks: 'none', stains: 'none', peeling: 'none' },
  good: { cracks: 'none', stains: 'light', peeling: 'none' },
  fair: { cracks: 'light', stains: 'light', peeling: 'none' },
  worn: { cracks: 'moderate', stains: 'moderate', peeling: 'light' },
  failing: { cracks: 'heavy', stains: 'heavy', peeling: 'moderate' },
} satisfies Record<Wear, PaintWear>

// A share of the Worn look, the scale wornShare returns. Moderate is the Worn look and heavy is the Failing look. The light share is a
// hand-tuned working number.
export const PAINT_WEAR_SHARE = {
  none: 0,
  light: 0.5,
  moderate: 1,
  heavy: WEAR_AMOUNT.failing / WEAR_AMOUNT.worn,
} satisfies Record<PaintWearLevel, number>

// Each painted surface's peeling seed, read by the parts that draw it and by the checks, so a surface keeps its patches in place
// and the checks place the same ones.
export const PEELING_SEEDS = {
  house: { back: 81, left: 82, right: 83, front: 85 },
  foundation: { back: 91, left: 92, right: 93, front: 95 },
  door: 87,
  fascia: { front: 111, back: 113 },
  gable: { left: 121, right: 122 },
  parapet: { back: 131, left: 132, right: 133, front: 135 },
} as const

// Each painted surface's stain seeds, read by the parts that draw them and by the checks, so a surface keeps its stains in place
// and the checks place the same ones. The streak and blotch seeds are the ones the walls were drawn with, so the eave walls look
// as they did; a gable wall's vent takes streak slots of its own, so its streaks draw from a seed of their own.
export const STAIN_SEEDS = {
  streaks: { back: 21, left: 22, right: 23, front: 25 },
  blotches: { back: 31, left: 32, right: 33, front: 35 },
  vent: { left: 141, right: 142 },
} as const
