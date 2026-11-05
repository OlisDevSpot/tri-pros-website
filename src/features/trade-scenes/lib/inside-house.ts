import type { Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'

// Inside the Complete house: within the walls, above grade and under the roof's underside, in the house's own metres.
export function insideHouse([x, y, z]: Vec3, form: RoofForm): boolean {
  if (Math.abs(x) >= HOUSE.halfLength || Math.abs(z) >= HOUSE.halfDepth || y <= 0) {
    return false
  }
  return y < roofUndersideY(z, form)
}
