import type { FoundationType } from '@/shared/modules/construction/core/constants/enums'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { homeFloorY } from '@/features/trade-scenes/lib/home-floor-y'

// How far the foundation raises or settles the house from the height it is drawn at.
export function homeLift(foundationType: FoundationType | null): number {
  return homeFloorY(foundationType) - HOUSE.floorY
}
