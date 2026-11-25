import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { CONTROLS_COPY, LOT_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'

// Mixed where one chip covers ground of several wears.
export function conditionTitle(wear: Wear | 'mixed' | null): string {
  const label = wear === null ? null : wear === 'mixed' ? LOT_COPY.mixed : WEAR_LABELS[wear]
  return label === null ? CONTROLS_COPY.systems.condition : `${CONTROLS_COPY.systems.condition}${CONTROLS_COPY.systems.valueJoin}${label}`
}
