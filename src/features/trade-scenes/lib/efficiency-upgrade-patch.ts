import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

type UpgradeState = Pick<TradeSceneInputs, 'efficiencyUpgrades'>

export function efficiencyUpgradePatch(state: UpgradeState, upgrade: EfficiencyUpgradeId, on: boolean): UpgradeState {
  const others = state.efficiencyUpgrades.filter(candidate => candidate !== upgrade)
  return { efficiencyUpgrades: on ? [...others, upgrade] : others }
}
