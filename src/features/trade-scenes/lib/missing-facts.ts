import type { FactsTab, HomeFactId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// In tab order. "Not sure" records null, so a fact left at it stays missing.
export const HOME_FACTS: readonly { id: HomeFactId, tab: FactsTab, read: (state: TradeSceneInputs) => string | null }[] = [
  { id: 'foundation', tab: 'main', read: state => state.property.foundationType },
  { id: 'roof-form', tab: 'main', read: state => roofFormOf(state.property.roofType) },
  { id: 'household', tab: 'household', read: state => state.household.type },
  { id: 'age-group', tab: 'household', read: state => state.household.ageGroup },
  { id: 'climate', tab: 'area', read: state => state.climate },
]

export function missingFacts(state: TradeSceneInputs): HomeFactId[] {
  return HOME_FACTS.filter(fact => fact.read(state) === null).map(fact => fact.id)
}
