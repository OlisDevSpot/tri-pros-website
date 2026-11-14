import type { HomeSpotContext, HomeSpotId, HomeSystemId } from '@/features/trade-scenes/types'

import { LOOK_INSIDE_SYSTEM_IDS, SPOT_OF } from '@/features/trade-scenes/constants/home-systems'
import { atticReachable } from '@/shared/modules/construction/core/lib/attic-reachable'
import { isDuctedSystem } from '@/shared/modules/construction/core/lib/hvac-system'

export function systemsAtSpot(spot: HomeSpotId, ctx: HomeSpotContext): HomeSystemId[] {
  switch (spot) {
    case 'roof': return atticReachable(ctx.form, ctx.picks) ? ['roof', 'attic'] : ['roof']
    case 'equipment': return isDuctedSystem(ctx.hvacType) ? ['heating-cooling'] : []
    case 'window': return ['windows']
    case 'wall': return ['walls']
    case 'foundation': return ['foundation']
  }
}

export function canLookInside(system: HomeSystemId, ctx: HomeSpotContext): boolean {
  const lookInside = LOOK_INSIDE_SYSTEM_IDS.find(id => id === system)
  return lookInside !== undefined && systemsAtSpot(SPOT_OF[lookInside], ctx).includes(system)
}
