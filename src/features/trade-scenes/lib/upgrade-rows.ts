import type { HomeSystemRows } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts, OfferKind, ResolvedPart } from '@/shared/modules/construction/core/types'

import { HOME_SYSTEMS } from '@/features/trade-scenes/constants/home-systems'
import { existingParts, materialOfPart, offeredScopes, partOffers, partWear } from '@/features/trade-scenes/lib/part-offers'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// The scene credits an install only when it beats what the home has there, with the efficiency upgrades applied, so the row says the same.
function kindOf(scopeId: ScopeId, existing: readonly ResolvedPart[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): OfferKind {
  const entry = SCOPE_INSTALLS[scopeId]
  const parts = entry ? ASSEMBLIES[entry.assembly].parts : []
  const saves = (entry?.installs ?? []).some(({ part, material, swapsWith }) => {
    const definition = parts.find(candidate => candidate.id === part)
    const installed = efficiencyUpgrades.flatMap(upgrade => swapsWith?.[upgrade] ?? []).at(0) ?? material
    return definition !== undefined && installKind(definition, existing.find(candidate => candidate.id === part)?.material ?? null, installed) === 'saves-energy'
  })
  return saves ? 'saves-energy' : 'like-for-like'
}

export function upgradeRows(facts: HomeFacts, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): HomeSystemRows[] {
  const { property } = facts
  const home = resolveHomeMaterials(facts)
  const unitless = property.hvacType === 'wall-mounted' || property.hvacType === 'portable'

  return HOME_SYSTEMS.flatMap(({ id, rows }): HomeSystemRows[] => {
    if (id === 'heating-cooling' && unitless) {
      // Nothing is offered for a wall or portable unit, but the system keeps its place so the rep sees why.
      const [{ part }] = rows
      const offer = partOffers('hvac-attic').find(candidate => candidate.partId === part)
      const existing = existingParts('hvac-attic', facts).find(candidate => candidate.id === part)
      return offer && existing ? [{ id, rows: [{ part, offer, existing, material: 'heating-cooling' as const, scopeIds: [], blocked: 'no-offer-for-unit' as const, kinds: {} }] }] : []
    }
    const built = rows.flatMap(({ assembly, part }) => {
      const offer = partOffers(assembly).find(candidate => candidate.partId === part)
      if (!(ASSEMBLIES[assembly].appliesTo?.(property) ?? true)) {
        return []
      }
      const existingAssembly = existingParts(assembly, facts)
      const existing = existingAssembly.find(candidate => candidate.id === part)
      if (!offer || !existing) {
        return []
      }
      const { scopeIds, blocked } = offeredScopes(offer, { roofType: property.roofType, picks, existing: existingAssembly, assemblyId: assembly, wear: partWear(assembly, part, home) })
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
