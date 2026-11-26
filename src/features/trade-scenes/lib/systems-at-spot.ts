import type { HomeSpotContext, HomeSpotId, HomeSystemId } from '@/features/trade-scenes/types'

import { HOME_SPOT_IDS, LOOK_INSIDE_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { atticReachable } from '@/shared/modules/construction/core/lib/attic-reachable'
import { centralComponents, isCentralSystem, isDuctedSystem } from '@/shared/modules/construction/core/lib/hvac-system'

function picksInstall(picks: readonly string[], parts: readonly string[]): boolean {
  return picks.some(pick => SCOPE_INSTALLS[pick]?.installs.some(install => parts.includes(install.part)) ?? false)
}

// Under a gable a ducted system's air leaves into the attic, from an attic unit's plenum, a closet's trunk or a package unit's;
// a flat roof's joist space is no place to show it from.
function airInAttic(ctx: HomeSpotContext): boolean {
  return ctx.form === 'pitched' && (isDuctedSystem(ctx.hvacType) || picksInstall(ctx.picks, ['plenum']))
}

// Today or a pick stands an outdoor unit beside the house: a package unit, mini-splits, or a central system that cools.
function outdoorUnit(ctx: HomeSpotContext): boolean {
  const today = ctx.hvacType === 'package-unit' || ctx.hvacType === 'mini-split' || (isCentralSystem(ctx.hvacType) && centralComponents(ctx.hvacComponents) !== 'furnace')
  return today || picksInstall(ctx.picks, ['condenser', 'mini-split-outdoor'])
}

export function systemsAtSpot(spot: HomeSpotId, ctx: HomeSpotContext): HomeSystemId[] {
  switch (spot) {
    case 'roof': {
      const roof: HomeSystemId[] = atticReachable(ctx.form, ctx.picks) ? ['roof', 'attic'] : ['roof']
      return airInAttic(ctx) ? [...roof, 'heating-cooling'] : roof
    }
    case 'equipment': return outdoorUnit(ctx) ? ['heating-cooling'] : []
    case 'window': return ['windows']
    case 'wall': return ['walls']
    case 'foundation': return ['foundation']
  }
}

// A system is looked inside from whichever spot offers it, so heating & cooling still opens on a home with nothing outside.
export function canLookInside(system: HomeSystemId, ctx: HomeSpotContext): boolean {
  return (LOOK_INSIDE_SYSTEM_IDS as readonly HomeSystemId[]).includes(system) && HOME_SPOT_IDS.some(spot => systemsAtSpot(spot, ctx).includes(system))
}
