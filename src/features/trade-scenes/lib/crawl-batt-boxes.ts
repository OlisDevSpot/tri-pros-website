import type { BoxSpec } from '@/features/trade-scenes/types'

import { FOUNDATION } from '@/features/trade-scenes/constants/home-details'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { framingGrid } from '@/features/trade-scenes/lib/home-roof-layout'
import { wornValue } from '@/features/trade-scenes/lib/part-state'

const { halfLength: L, halfDepth: D, wallThickness: T, joistWidth, framingSpacing, floorY, floorThickness } = HOUSE
const UNDER_FLOOR = floorY - floorThickness
// Clear of the joists' faces and the subfloor, so no two faces share a plane.
const CLEARANCE = 0.006
// Each bay sags a different share, so a worn run reads as hung by hand.
const SAG_SHARES = [1, 0.55, 0.8]

/** One batt in each bay between the floor joists, hung from the subfloor; wear lets them drop below the joists. */
export function crawlBattBoxes(wear: number): BoxSpec[] {
  const joists = framingGrid(-L + T + FOUNDATION.joistInset, L - T - FOUNDATION.joistInset, framingSpacing)
  const sag = wornValue(0, WEAR_LOOKS.crawlBattSag, wear)
  const thickness = FOUNDATION.joistDepth - CLEARANCE
  return joists.slice(1).map((x, index) => {
    const from = joists[index]
    const drop = sag * SAG_SHARES[index % SAG_SHARES.length]
    return {
      size: [x - from - joistWidth - CLEARANCE, thickness, D * 2 - T * 2 - CLEARANCE],
      position: [(x + from) / 2, UNDER_FLOOR - CLEARANCE - thickness / 2 - drop, 0],
    }
  })
}
