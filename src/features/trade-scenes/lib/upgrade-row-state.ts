import type { HomeSystemRow, UpgradeRowBlockedLine, UpgradeRowState } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { HomeFacts } from '@/shared/modules/construction/core/types'

import { SCOPES_AND_ADDONS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { coolRoofOn } from '@/features/trade-scenes/lib/cool-roof-on'
import { baseIncludedLabel, existingParts } from '@/features/trade-scenes/lib/part-offers'
import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { UPGRADE_SCOPES } from '@/shared/modules/construction/core/constants/upgrade-scopes'

export function upgradeRowState(row: HomeSystemRow, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): UpgradeRowState {
  const picked = row.scopeIds.find(scopeId => picks.includes(scopeId)) ?? null
  return {
    picked,
    holdsCoolRoof: offersEfficiencyUpgrade(row.offer.scopeIds, 'cool-roof'),
    holdsR8: offersEfficiencyUpgrade(row.offer.scopeIds, 'r8-ducts'),
    holdsCoolPaint: offersEfficiencyUpgrade(row.offer.scopeIds, 'cool-paint', row.existing.material),
    holdsR38: offersEfficiencyUpgrade(row.offer.scopeIds, 'r38-insulation'),
    holdsBatts: row.offer.scopeIds.some(scopeId => SCOPE_INSTALLS[scopeId]?.installs.some(install => install.styles?.batts !== undefined)),
    coolRoofOffered: offersEfficiencyUpgrade(picks, 'cool-roof'),
    coolRoofOn: coolRoofOn(picks, efficiencyUpgrades),
    coolPaintOn: picked === UPGRADE_SCOPES['cool-paint'].upgraded,
    r8On: efficiencyUpgrades.includes('r8-ducts') && picked !== null,
  }
}

export function upgradeRowBlockedLine(row: HomeSystemRow, facts: HomeFacts, picks: readonly string[]): UpgradeRowBlockedLine | null {
  switch (row.blocked) {
    case null:
      return null
    case 'base-included':
      return { included: true, text: baseIncludedLabel(row.offer.assemblyId, picks, existingParts(row.offer.assemblyId, facts)) }
    case 'no-offer-for-unit':
      return { included: false, text: SCOPES_AND_ADDONS_COPY.unitBlocked[facts.property.hvacType === 'portable' ? 'portable' : 'wall-mounted'] }
    default:
      return { included: false, text: SCOPES_AND_ADDONS_COPY.blocked[row.blocked] }
  }
}
