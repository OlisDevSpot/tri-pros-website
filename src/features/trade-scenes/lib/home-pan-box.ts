import type { PanBox } from '@/shared/components/scene/types'

import { HOME_PAN, HOUSE, RIDGE_Y, ROOF_HALF_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, STREET_Z } from '@/features/trade-scenes/constants/home-lot'

// The top rises with a raised floor so the roof framing stays inside it; the floor stays on the ground whatever the lift.
export function homePanBox(lift: number): PanBox {
  return {
    min: [-(ROOF_HALF_LENGTH + HOME_PAN.margin), 0, -(HOUSE.halfDepth + HOME_PAN.margin)],
    max: [GARAGE.x1 + HOME_PAN.margin, RIDGE_Y + HOME_PAN.aboveRidge + Math.max(lift, 0), STREET_Z.sidewalk[1]],
  }
}
