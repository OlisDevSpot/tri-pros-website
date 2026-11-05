import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts, ResolvedPart } from '@/shared/modules/construction/core/types'

import { existingParts } from '@/features/trade-scenes/lib/part-offers'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { UPGRADE_SCOPES } from '@/shared/modules/construction/core/constants/upgrade-scopes'

type UpgradeWithScopes = keyof typeof UPGRADE_SCOPES

const UPGRADES_WITH_SCOPES = Object.keys(UPGRADE_SCOPES) as UpgradeWithScopes[]

function upgradedInstall(upgrade: UpgradeWithScopes) {
  const entry = SCOPE_INSTALLS[UPGRADE_SCOPES[upgrade].upgraded]
  const install = entry?.installs[0]
  return entry && install ? { assembly: entry.assembly, ...install } : null
}

// A home that already has the upgraded material repaints with it whatever the switch says, so a repaint never goes down.
export function upgradeScope(upgrade: UpgradeWithScopes, efficiencyUpgrades: readonly EfficiencyUpgradeId[], existingMaterial: string | null): ScopeId {
  const { plain, upgraded } = UPGRADE_SCOPES[upgrade]
  if (efficiencyUpgrades.includes(upgrade)) {
    return upgraded
  }
  const install = upgradedInstall(upgrade)
  const materials = install ? ASSEMBLIES[install.assembly].parts.find(part => part.id === install.part)?.materials : undefined
  const upgradedRank = install ? materials?.[install.material]?.energyRank : undefined
  const existingRank = existingMaterial === null ? undefined : materials?.[existingMaterial]?.energyRank
  return upgradedRank !== undefined && existingRank !== undefined && existingRank >= upgradedRank ? upgraded : plain
}

function existingMaterialOf(upgrade: UpgradeWithScopes, existing: readonly ResolvedPart[]) {
  const install = upgradedInstall(upgrade)
  return install ? existing.find(part => part.id === install.part)?.material ?? null : null
}

// The pair member each upgrade does not name, so a part's row offers one chip.
export function unnamedUpgradeScopes(assemblyId: AssemblyId, efficiencyUpgrades: readonly EfficiencyUpgradeId[], existing: readonly ResolvedPart[]): ScopeId[] {
  return UPGRADES_WITH_SCOPES.flatMap((upgrade) => {
    if (upgradedInstall(upgrade)?.assembly !== assemblyId) {
      return []
    }
    const { plain, upgraded } = UPGRADE_SCOPES[upgrade]
    return upgradeScope(upgrade, efficiencyUpgrades, existingMaterialOf(upgrade, existing)) === upgraded ? [plain] : [upgraded]
  })
}

export function withUpgradeScopes(picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[], facts: HomeFacts): string[] {
  return picks.map((pick) => {
    const upgrade = UPGRADES_WITH_SCOPES.find(candidate => pick === UPGRADE_SCOPES[candidate].plain || pick === UPGRADE_SCOPES[candidate].upgraded)
    const install = upgrade ? upgradedInstall(upgrade) : null
    return upgrade && install ? upgradeScope(upgrade, efficiencyUpgrades, existingMaterialOf(upgrade, existingParts(install.assembly, facts))) : pick
  })
}
