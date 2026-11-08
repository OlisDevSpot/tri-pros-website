import type { PaintComboId } from '@/shared/modules/construction/core/constants/cool-life-colors'
import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'

import { PAINT_COMBOS } from '@/shared/modules/construction/core/constants/cool-life-colors'

// Reads the colours the swatches show, the home's own where nothing is picked, so a home already in a combo shows it
// picked. The remembered combo only says where changed colours came from.
export function paintComboState(materials: Pick<HomeMaterialFacts, 'existingPaintColors' | 'proposedPaintColors'>): { picked: PaintComboId | null, from: PaintComboId | null } {
  const { existingPaintColors: existing, proposedPaintColors: proposed } = materials
  const body = proposed.body ?? existing.body
  const trim = proposed.trim ?? existing.trim
  const picked = PAINT_COMBOS.find(combo => combo.body === body && combo.trim === trim)?.id ?? null
  return { picked, from: picked === null ? proposed.combo : null }
}
