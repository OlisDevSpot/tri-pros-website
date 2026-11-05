import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { RoofType, Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts, ResolvedHomeMaterials, ResolvedPart } from '@/shared/modules/construction/core/types'

import { INFER_EXISTING_CONDITIONS } from '@/features/trade-scenes/constants/existing-conditions'
import { requiredUpgrade } from '@/features/trade-scenes/lib/required-upgrade'
import { unnamedUpgradeScopes } from '@/features/trade-scenes/lib/upgrade-scopes'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { SCOPES_BY_EXISTING_ROOF } from '@/shared/modules/construction/core/constants/scopes-by-existing-roof'
import { atticReachable } from '@/shared/modules/construction/core/lib/attic-reachable'
import { redeckAllowed } from '@/shared/modules/construction/core/lib/redeck-allowed'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

export interface PartOffer {
  assemblyId: AssemblyId
  partId: string
  scopeIds: ScopeId[]
  dependsOnRoof: boolean
}

export type OfferBlockedReason = 'roof-not-set' | 'nothing-on-roof' | 'needs-tear-off' | 'needs-redeck' | 'base-included' | 'already-new' | 'no-offer-for-unit'

// A scope's own reasons; a unit with nothing to offer blocks the whole system's row, not one scope.
type ScopeBlockedReason = Exclude<OfferBlockedReason, 'no-offer-for-unit'>

interface OfferContext {
  roofType: RoofType | null
  picks: readonly string[]
  existing: readonly ResolvedPart[]
  assemblyId: AssemblyId
  // The wear of the home material that draws the part; unset reads as Worn.
  wear: Wear | null | undefined
  efficiencyUpgrades: readonly EfficiencyUpgradeId[]
}

type HomeAssemblyId = Exclude<AssemblyId, 'yard-ground'>

const HOME_ASSEMBLY_IDS = ASSEMBLY_IDS.filter((id): id is HomeAssemblyId => id !== 'yard-ground')

const ROOF_SCOPE_IDS: ReadonlySet<string> = new Set(Object.values(SCOPES_BY_EXISTING_ROOF).flat())

export function partOffers(assemblyId: AssemblyId): PartOffer[] {
  const byPart = new Map<string, ScopeId[]>()
  for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
    const part = entry?.assembly === assemblyId ? entry.installs[0]?.part : undefined
    if (part !== undefined) {
      byPart.set(part, [...byPart.get(part) ?? [], scopeId as ScopeId])
    }
  }
  const parts = ASSEMBLIES[assemblyId].parts
  const ordered = [...parts].reverse().filter(part => byPart.has(part.id))
  // Edge parts (drip edge, gutters) sit past the surfaces they trim.
  const offers = [...ordered.filter(part => !('edge' in part && part.edge)), ...ordered.filter(part => 'edge' in part && part.edge)]
  return offers.map((part) => {
    const scopeIds = byPart.get(part.id) ?? []
    return { assemblyId, partId: part.id, scopeIds, dependsOnRoof: scopeIds.some(id => ROOF_SCOPE_IDS.has(id)) }
  })
}

function existingFor(assemblyId: HomeAssemblyId, facts: HomeFacts, home: ResolvedHomeMaterials): ResolvedPart[] {
  return resolveAssembly(ASSEMBLIES[assemblyId], { existing: INFER_EXISTING_CONDITIONS[assemblyId](facts, home), proposedScopeIds: [], view: 'existing' })
}

export function existingParts(assemblyId: AssemblyId, facts: HomeFacts): ResolvedPart[] {
  return assemblyId === 'yard-ground' ? [] : existingFor(assemblyId, facts, resolveHomeMaterials(facts))
}

// Looked up, never set by hand, so a part and the material that ages it cannot drift apart.
export function materialOfPart(assemblyId: AssemblyId, partId: string): HomeMaterialId | null {
  return HOME_MATERIAL_IDS.find(id => HOME_MATERIALS[id].parts.some(entry => entry.assembly === assemblyId && entry.part === partId)) ?? null
}

export function partWear(assemblyId: AssemblyId, partId: string, home: ResolvedHomeMaterials): Wear | null {
  const id = materialOfPart(assemblyId, partId)
  return id === null ? null : home[id]?.wear ?? null
}

// A base only counts as included when the existing part is one the base replaces; otherwise it stays and is offered on its own.
function picksBases(assemblyId: AssemblyId, picks: readonly string[]) {
  const assembly = ASSEMBLIES[assemblyId]
  return picks.flatMap((pick) => {
    const entry = SCOPE_INSTALLS[pick]
    if (entry?.assembly !== assemblyId) {
      return []
    }
    return entry.installs.flatMap((install) => {
      const needsBase = assembly.parts.find(part => part.id === install.part)?.materials[install.material]?.needsBase
      return needsBase ? [needsBase] : []
    })
  })
}

function includedBase(partId: string, ctx: Pick<OfferContext, 'picks' | 'existing' | 'assemblyId'>) {
  const existingMaterial = ctx.existing.find(part => part.id === partId)?.material
  return picksBases(ctx.assemblyId, ctx.picks).find(base => base.part === partId && existingMaterial != null && base.replaces.includes(existingMaterial))
}

// What the home already has decides what is offered on its part: with nothing there only an install that adds to it, and
// never a scope that could not at least match what is there.
function followsWhatIsThere(offer: PartOffer, ctx: Pick<OfferContext, 'existing' | 'assemblyId'>, scopeIds: readonly ScopeId[], homeHasPart: boolean): ScopeId[] {
  const part = ASSEMBLIES[ctx.assemblyId].parts.find(candidate => candidate.id === offer.partId)!
  const existing = ctx.existing.find(candidate => candidate.id === offer.partId)?.material ?? null
  const addsTo = (id: ScopeId) => SCOPE_INSTALLS[id]?.installs.some(install => install.part === offer.partId && install.addsTo) ?? false
  const onEmpty = !homeHasPart && offer.scopeIds.some(addsTo) ? scopeIds.filter(addsTo) : scopeIds
  return onEmpty.filter(id => requiredUpgrade(id, part, existing) !== 'not-offered')
}

export function offeredScopes(offer: PartOffer, ctx: OfferContext): { scopeIds: ScopeId[], blocked: ScopeBlockedReason | null } {
  // A part the home lacks (gutters on a roof with none) is still offered under a new roof: there is nothing new to protect.
  const homeHasPart = ctx.existing.some(part => part.id === offer.partId && part.condition !== 'absent')
  if (ctx.wear === 'new' && homeHasPart) {
    return { scopeIds: [], blocked: 'already-new' }
  }
  if (offer.partId === 'attic-insulation' && !atticReachable(roofFormOf(ctx.roofType), ctx.picks)) {
    return { scopeIds: [], blocked: 'needs-redeck' }
  }
  // A part its form lacks never resolves, so it has no row to offer from.
  if (!offer.dependsOnRoof) {
    // An upgrade that files its options as two scopes offers the one it names, and only on the row for the part the pair installs.
    const unnamed = unnamedUpgradeScopes(ctx.assemblyId, ctx.efficiencyUpgrades, ctx.existing)
      .filter(id => SCOPE_INSTALLS[id]?.installs.some(install => install.part === offer.partId))
    return { scopeIds: followsWhatIsThere(offer, ctx, offer.scopeIds.filter(id => !unnamed.includes(id)), homeHasPart), blocked: null }
  }
  if (ctx.roofType === null) {
    return { scopeIds: [], blocked: 'roof-not-set' }
  }
  const roofType = ctx.roofType
  const onRoof = offer.scopeIds.filter(id => SCOPES_BY_EXISTING_ROOF[roofType].includes(id))
  if (onRoof.length === 0) {
    return { scopeIds: [], blocked: 'nothing-on-roof' }
  }
  if (includedBase(offer.partId, ctx)) {
    return { scopeIds: [], blocked: 'base-included' }
  }
  if (offer.partId === 'deck' && !redeckAllowed(ctx.picks)) {
    return { scopeIds: [], blocked: 'needs-tear-off' }
  }
  return { scopeIds: followsWhatIsThere(offer, ctx, onRoof, homeHasPart), blocked: null }
}

export function baseIncludedLabel(assemblyId: AssemblyId, picks: readonly string[], existing: readonly ResolvedPart[]): string | null {
  const bases = picksBases(assemblyId, picks)
  return bases.flatMap(base => includedBase(base.part, { assemblyId, picks, existing }) ?? []).at(0)?.copy.label ?? null
}

export function keepOffered(picks: readonly string[], facts: HomeFacts, efficiencyUpgrades: readonly EfficiencyUpgradeId[]): string[] {
  const home = resolveHomeMaterials(facts)
  const { property } = facts
  const views = HOME_ASSEMBLY_IDS.map(id => ({
    id,
    applies: ASSEMBLIES[id].appliesTo?.(property) ?? true,
    existing: existingFor(id, facts, home),
    offers: partOffers(id),
  }))
  let kept = [...picks]
  for (;;) {
    const next = kept.filter((pick) => {
      const view = views.find(candidate => candidate.id === SCOPE_INSTALLS[pick]?.assembly)
      const offer = view?.offers.find(candidate => (candidate.scopeIds as string[]).includes(pick))
      if (!view || !offer) {
        return true
      }
      // The assembly not applying (a wall unit has no ducts to replace), or its form dropping the part (a package unit has no air handler), takes the pick with it.
      if (!view.applies || !view.existing.some(part => part.id === offer.partId)) {
        return false
      }
      const ctx = { roofType: property.roofType, picks: kept, existing: view.existing, assemblyId: view.id, wear: partWear(view.id, offer.partId, home), efficiencyUpgrades }
      return (offeredScopes(offer, ctx).scopeIds as string[]).includes(pick)
    })
    if (next.length === kept.length) {
      return next
    }
    kept = next
  }
}

export function alsoNewLabels(assemblyId: AssemblyId, facts: HomeFacts, scopeId: ScopeId): string[] {
  if (assemblyId === 'yard-ground') {
    return []
  }
  const own = new Set(partOffers(assemblyId).map(offer => offer.partId))
  const existing = INFER_EXISTING_CONDITIONS[assemblyId](facts, resolveHomeMaterials(facts))
  return resolveAssembly(ASSEMBLIES[assemblyId], { existing, proposedScopeIds: [scopeId], view: 'proposed' })
    .filter(part => part.condition === 'installed' && !own.has(part.id))
    .map(part => part.label)
}
