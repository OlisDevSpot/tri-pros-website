import type { HomeSpotContext, HomeSpotId, HomeSystemId } from '@/features/trade-scenes/types'

import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { LOOK_INSIDE_SYSTEM_IDS, SPOT_OF } from '@/features/trade-scenes/constants/home-systems'
import { HVAC_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/hvac-attic'
import { atticReachable } from '@/shared/modules/construction/core/lib/attic-reachable'

export function systemsAtSpot(spot: HomeSpotId, ctx: HomeSpotContext): HomeSystemId[] {
  switch (spot) {
    case 'roof': return atticReachable(ctx.form, ctx.picks) ? ['roof', 'attic'] : ['roof']
    // The ducts' assembly reads only the system type, so a profile that knows nothing else answers the same.
    case 'equipment': return HVAC_ATTIC.appliesTo({ ...HOME_SCENE_DEFAULTS.property, hvacType: ctx.hvacType }) ? ['heating-cooling'] : []
    case 'window': return ['windows']
    case 'wall': return ['walls']
  }
}

export function canLookInside(system: HomeSystemId, ctx: HomeSpotContext): boolean {
  const lookInside = LOOK_INSIDE_SYSTEM_IDS.find(id => id === system)
  return lookInside !== undefined && systemsAtSpot(SPOT_OF[lookInside], ctx).includes(system)
}
