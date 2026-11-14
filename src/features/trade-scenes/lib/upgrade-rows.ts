import type { HomeSystemRows } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts, OfferKind, ResolvedPart } from '@/shared/modules/construction/core/types'

import { HOME_SYSTEMS } from '@/features/trade-scenes/constants/home-systems'
import { existingParts, materialOfPart, offeredScopes, partOffers, partWear } from '@/features/trade-scenes/lib/part-offers'
import { requiredUpgrade } from '@/features/trade-scenes/lib/required-upgrade'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'
import { installedMaterialId } from '@/shared/modules/construction/core/lib/installed-material'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { scopeFitsHome } from '@/shared/modules/construction/core/lib/scope-fits-home'

// The scene credits an install only when it beats what the home has there, with the efficiency upgrades applied, so the row says the same.
// An upgrade the scope cannot go without counts before it is picked, so a top off over R-30 reads as the R-38 it will be.
function kindOf(scopeId: ScopeId, existing: readonly ResolvedPart[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): OfferKind {
  const entry = SCOPE_INSTALLS[scopeId]
  const parts = entry ? ASSEMBLIES[entry.assembly].parts : []
  const saves = (entry?.installs ?? []).some((install) => {
    const { part } = install
    const definition = parts.find(candidate => candidate.id === part)
    if (definition === undefined) {
      return false
    }
    const existingMaterial = existing.find(candidate => candidate.id === part)?.material ?? null
    const required = requiredUpgrade(scopeId, definition, existingMaterial)
    const installed = installedMaterialId(install, required === null || required === 'not-offered' ? efficiencyUpgrades : [...efficiencyUpgrades, required])
    return installKind(definition, existingMaterial, installed) === 'saves-energy'
  })
  return saves ? 'saves-energy' : 'like-for-like'
}

export function upgradeRows(facts: HomeFacts, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): HomeSystemRows[] {
  const { property } = facts
  const home = resolveHomeMaterials(facts)

  return HOME_SYSTEMS.flatMap(({ id, rows }): HomeSystemRows[] => {
    const built = rows.flatMap(({ assembly, part }) => {
      const filed = partOffers(assembly).find(candidate => candidate.partId === part)
      if (!(ASSEMBLIES[assembly].appliesTo?.(property) ?? true)) {
        return []
      }
      const existingAssembly = existingParts(assembly, facts)
      const existing = existingAssembly.find(candidate => candidate.id === part)
      if (!filed || !existing) {
        return []
      }
      // Narrowed once, so the row's switches, kinds and picks see only this home's jobs: a new system files under the
      // blower on every home, and would otherwise hand a central home's system row a second R-8 switch.
      const offer = { ...filed, scopeIds: filed.scopeIds.filter(scopeId => scopeFitsHome(SCOPE_INSTALLS[scopeId]!, existingAssembly)) }
      const { scopeIds, blocked } = offeredScopes(offer, { roofType: property.roofType, picks, existing: existingAssembly, assemblyId: assembly, wear: partWear(assembly, part, home, existingAssembly), efficiencyUpgrades })
      if (offer.scopeIds.length === 0 && blocked === null) {
        return []
      }
      return [{
        part,
        offer,
        existing,
        material: materialOfPart(assembly, part),
        scopeIds,
        blocked,
        kinds: Object.fromEntries(offer.scopeIds.map(scopeId => [scopeId, kindOf(scopeId, existingAssembly, efficiencyUpgrades)])),
      }]
    })
    return built.length === 0 ? [] : [{ id, rows: built }]
  })
}
