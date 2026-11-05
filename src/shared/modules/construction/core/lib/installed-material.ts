import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { PartMaterialDefinition, ScopeInstall } from '@/shared/modules/construction/core/types'

import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

// The efficiency swap first, then the style's look of whatever it swapped to, so a style never changes the efficiency.
export function installedMaterialId(install: ScopeInstall['installs'][number], efficiencyUpgrades: readonly EfficiencyUpgradeId[], installStyles: readonly InstallStyleId[] = []): string {
  const swapped = efficiencyUpgrades.flatMap(upgrade => install.swapsWith?.[upgrade] ?? []).at(0) ?? install.material
  return installStyles.flatMap(style => install.styles?.[style]?.[swapped] ?? []).at(0) ?? swapped
}

export function installedMaterial(scopeId: ScopeId, efficiencyUpgrades: readonly EfficiencyUpgradeId[], installStyles: readonly InstallStyleId[] = []): PartMaterialDefinition {
  const entry = SCOPE_INSTALLS[scopeId]
  if (!entry) {
    throw new Error(`Scope ${scopeId} has no installs`)
  }
  const [install] = entry.installs
  const material = ASSEMBLIES[entry.assembly].parts.find(part => part.id === install.part)?.materials[installedMaterialId(install, efficiencyUpgrades, installStyles)]
  if (!material) {
    throw new Error(`Scope ${scopeId} installs a material its assembly does not offer`)
  }
  return material
}
