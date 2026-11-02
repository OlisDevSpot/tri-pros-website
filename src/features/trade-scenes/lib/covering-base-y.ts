import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { COVERING_BASE, HOUSE, LOW_SLOPE_ROOF_Y, RIDGE_Y } from '@/features/trade-scenes/constants/home-geometry'

// The covering's base over z, or a flat roof's membrane top. The gable falls away from the ridge on both sides, so either
// slope reads right off it.
export function coveringBaseY(z: number, form: RoofForm): number {
  return form === 'pitched' ? RIDGE_Y - Math.abs(z) * Math.tan(HOUSE.pitch) + COVERING_BASE / Math.cos(HOUSE.pitch) : LOW_SLOPE_ROOF_Y
}
