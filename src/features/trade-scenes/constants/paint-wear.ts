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
} as const
