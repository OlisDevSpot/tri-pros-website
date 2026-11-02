import type { FoundationType } from '@/shared/modules/construction/core/constants/enums'

import { HOME_FLOOR_Y } from '@/features/trade-scenes/constants/home-geometry'

// Unknown draws as slab: the house sits on grade, the simpler and more common SoCal case.
export function homeFloorY(foundationType: FoundationType | null): number {
  return foundationType === 'raised' ? HOME_FLOOR_Y.raised : HOME_FLOOR_Y.slab
}
