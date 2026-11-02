import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOUSE, LOW_SLOPE_DECK_Y, RAFTER_ORIGIN_Y } from '@/features/trade-scenes/constants/home-geometry'

// The height of the roof's underside, the deck's underside along the rafters' top, at a point `z` across the house.
export function roofUndersideY(z: number, form: RoofForm): number {
  return form === 'pitched' ? RAFTER_ORIGIN_Y + (HOUSE.halfDepth - Math.abs(z)) * Math.tan(HOUSE.pitch) : LOW_SLOPE_DECK_Y
}
