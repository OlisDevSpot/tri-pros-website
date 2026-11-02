import type { PartOffer } from '@/features/trade-scenes/lib/part-offers'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'

import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { keepOffered, partOffers } from '@/features/trade-scenes/lib/part-offers'
import { scopePreviewPatch } from '@/features/trade-scenes/lib/scope-preview-patch'

// Roof-dependent parts share one group: the deck's pick depends on the covering's, so a covering change must be able to drop it in the same write.
export function scopePick(state: TradeSceneInputs, offer: PartOffer, picked: ScopeId | null): Partial<TradeSceneInputs> {
  const group: string[] = offer.dependsOnRoof
    ? partOffers(HOME_PRIMARY_ASSEMBLY).filter(candidate => candidate.dependsOnRoof).flatMap(candidate => candidate.scopeIds)
    : offer.scopeIds
  const withPick = [...state.proposedScopeIds.filter(id => !offer.scopeIds.includes(id as ScopeId)), ...picked === null ? [] : [picked]]
  const kept = keepOffered(withPick, { property: state.property, materials: state.homeMaterials, year: currentYear() })
  return scopePreviewPatch(state, group, kept.filter(id => group.includes(id)))
}
