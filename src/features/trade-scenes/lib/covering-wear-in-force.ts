import type { CoveringWear } from '@/features/trade-scenes/types'
import type { RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { COVERING_WEAR_KINDS_BY_ROOF, COVERING_WEAR_START } from '@/features/trade-scenes/constants/covering-wear'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// The levels are one flat map across coverings, so a level counts only for a kind this roof type has; the rest take the start.
export function coveringWearInForce(material: ResolvedHomeMaterial | undefined, recorded: Partial<CoveringWear>, roofType: RoofType): CoveringWear {
  const wear = material ? wearInForce(material) : 'new'
  if (wear === 'new') {
    return COVERING_WEAR_START.new
  }
  const counted = Object.fromEntries(COVERING_WEAR_KINDS_BY_ROOF[roofType].flatMap(kind => recorded[kind] ? [[kind, recorded[kind]]] : []))
  return { ...COVERING_WEAR_START[wear], ...counted }
}
