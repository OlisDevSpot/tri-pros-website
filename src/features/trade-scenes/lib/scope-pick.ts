import type { PartOffer } from '@/features/trade-scenes/lib/part-offers'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { keepOffered, partOffers } from '@/features/trade-scenes/lib/part-offers'
import { scopePreviewPatch } from '@/features/trade-scenes/lib/scope-preview-patch'
import { withUpgradeScopes } from '@/features/trade-scenes/lib/upgrade-scopes'

// Roof-dependent parts share one group: the deck's pick depends on the covering's, so a covering change must be able to drop it in the same write.
export function scopePick(state: TradeSceneInputs, offer: PartOffer, picked: ScopeId | null): Partial<TradeSceneInputs> {
  const group: string[] = offer.dependsOnRoof
    ? partOffers(HOME_PRIMARY_ASSEMBLY).filter(candidate => candidate.dependsOnRoof).flatMap(candidate => candidate.scopeIds)
    : offer.scopeIds
  const withPick = [...state.proposedScopeIds.filter(id => !offer.scopeIds.includes(id as ScopeId)), ...picked === null ? [] : [picked]]
  const facts = { property: state.property, materials: state.homeMaterials, year: currentYear() }
  const offered = withUpgradeScopes(withPick, state.efficiencyUpgrades, facts)
  const kept = keepOffered(offered, facts, state.efficiencyUpgrades)
  const patch = scopePreviewPatch(state, group, kept.filter(id => group.includes(id)))
  // A pick outside the group can hang on one in it (a flat roof's insulation on its redeck), so it goes when that one does.
  return { ...patch, proposedScopeIds: patch.proposedScopeIds.filter(id => !offered.includes(id) || kept.includes(id)) }
}
