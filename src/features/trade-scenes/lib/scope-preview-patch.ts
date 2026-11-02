import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { keepEfficiencyUpgrades } from '@/features/trade-scenes/lib/keep-efficiency-upgrades'

type PreviewState = Pick<TradeSceneInputs, 'proposedScopeIds' | 'efficiencyUpgrades'>

export function scopePreviewPatch(
  state: PreviewState,
  groupScopeIds: readonly string[],
  nextInGroup: readonly string[],
): PreviewState {
  const proposedScopeIds = [...state.proposedScopeIds.filter(scopeId => !groupScopeIds.includes(scopeId)), ...nextInGroup]
  return { proposedScopeIds, efficiencyUpgrades: keepEfficiencyUpgrades(state.efficiencyUpgrades, proposedScopeIds) }
}
