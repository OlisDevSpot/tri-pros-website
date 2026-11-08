import type { PaintHexes } from '@/features/trade-scenes/types'
import type { CoolLifeColorId } from '@/shared/modules/construction/core/constants/cool-life-colors'

import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { COOL_LIFE_COLORS } from '@/shared/modules/construction/core/constants/cool-life-colors'

const hexOf = (id: CoolLifeColorId | null) => id === null ? null : COOL_LIFE_COLORS.find(color => color.id === id)!.hex

// A repaint takes only the colours it was given; the rest stay the home's own, so a one-colour pick leaves the other part alone.
export function paintHexes(materials: Pick<HomeMaterialFacts, 'existingPaintColors' | 'proposedPaintColors'>, repainted: boolean): PaintHexes {
  const { existingPaintColors: existing, proposedPaintColors: proposed } = materials
  return {
    body: (repainted ? hexOf(proposed.body) : null) ?? hexOf(existing.body) ?? HOME_PALETTE.stucco,
    trim: (repainted ? hexOf(proposed.trim) : null) ?? hexOf(existing.trim) ?? HOME_PALETTE.trim,
  }
}
