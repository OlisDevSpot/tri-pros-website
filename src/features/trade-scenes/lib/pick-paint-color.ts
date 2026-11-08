import type { CoolLifeColorId } from '@/shared/modules/construction/core/constants/cool-life-colors'
import type { HomeMaterialFacts, PaintPick } from '@/shared/modules/construction/core/types'

import { paintComboState } from '@/features/trade-scenes/lib/paint-combo-state'

// A pick that lands the shown colours on a combo makes that combo their origin, so a later change never names a combo the
// colours had already left.
export function pickPaintColor(materials: Pick<HomeMaterialFacts, 'existingPaintColors' | 'proposedPaintColors'>, part: 'body' | 'trim', id: CoolLifeColorId): PaintPick {
  const next = { ...materials.proposedPaintColors, [part]: id }
  const { picked } = paintComboState({ existingPaintColors: materials.existingPaintColors, proposedPaintColors: next })
  return { ...next, combo: picked ?? next.combo }
}
