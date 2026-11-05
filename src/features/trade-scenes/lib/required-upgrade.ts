import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { PartDefinition, ScopeInstall } from '@/shared/modules/construction/core/types'

import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'

type Install = ScopeInstall['installs'][number]

// A build never leaves the home with less than it has: an install that adds to the part must beat what is there, one that
// replaces it must at least match it.
function meetsTheBar(install: Install, part: PartDefinition, existing: string | null, material: string): boolean {
  if (existing === null) {
    return true
  }
  if (install.addsTo) {
    return installKind(part, existing, material) === 'saves-energy'
  }
  const existingRank = part.materials[existing].energyRank
  const installedRank = part.materials[material].energyRank
  return existingRank === undefined || (installedRank !== undefined && installedRank >= existingRank)
}

// null: the scope's own material clears the bar. An upgrade: the first one whose material does, which the pick then
// cannot go without. 'not-offered': nothing on offer does.
export function requiredUpgrade(scopeId: string, part: PartDefinition, existing: string | null): EfficiencyUpgradeId | null | 'not-offered' {
  const install = SCOPE_INSTALLS[scopeId]?.installs.find(candidate => candidate.part === part.id)
  if (!install || meetsTheBar(install, part, existing, install.material)) {
    return null
  }
  const swaps = Object.entries(install.swapsWith ?? {}) as [EfficiencyUpgradeId, string][]
  return swaps.find(([, material]) => meetsTheBar(install, part, existing, material))?.[0] ?? 'not-offered'
}
