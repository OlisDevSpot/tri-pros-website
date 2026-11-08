import type { PaintWear } from '@/features/trade-scenes/types'
import type { PaintWearLevel, Wear } from '@/shared/modules/construction/core/constants/enums'

import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'

export const PAINT_WEAR_START = {
  new: { 'cracks': 'none', 'stains': 'none', 'peeling': 'none', 'fascia-rot': 'none' },
  good: { 'cracks': 'none', 'stains': 'light', 'peeling': 'none', 'fascia-rot': 'none' },
  fair: { 'cracks': 'light', 'stains': 'light', 'peeling': 'none', 'fascia-rot': 'none' },
  worn: { 'cracks': 'moderate', 'stains': 'moderate', 'peeling': 'light', 'fascia-rot': 'none' },
  failing: { 'cracks': 'heavy', 'stains': 'heavy', 'peeling': 'moderate', 'fascia-rot': 'none' },
} satisfies Record<Wear, PaintWear>

// Fascia rot at the board ends. A spot at an end is `endWidth` along the board and runs its full height; heavy rot also runs a
// strip `bottomHeight` tall along the bottom edge of each board with a rotted end. A board joint falls every `boardLength` from
// the run's start. Working numbers, set by screenshot; `seed` keeps the rotted ends in place.
// A replacement cuts each rotted end out and sets in `newLength` of new board, a joint's both sides in one piece; a board rotted
// along its bottom is replaced whole. A seam shows `seam` past each end. Working numbers, set by screenshot.
export const FASCIA_ROT = {
  endWidth: 0.35,
  bottomHeight: 0.07,
  boardLength: 3.66,
  seed: 186,
  newLength: 1.2,
  seam: 0.012,
} as const

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
