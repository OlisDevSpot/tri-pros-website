import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { PropertyProfile } from '@/shared/modules/construction/core/types'

import { wears } from '@/shared/modules/construction/core/constants/enums'
import { ROOF_WEAR_LIMITS } from '@/shared/modules/construction/core/constants/roof-wear-limits'

export function wearChoices(id: HomeMaterialId, property: PropertyProfile): readonly Wear[] {
  const limit = id === 'roof' && property.roofType ? ROOF_WEAR_LIMITS[property.roofType] : undefined
  return limit?.choices ?? wears
}
