import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { AgeBands, HomeFacts, HomeMaterialDefinition, PropertyProfile, ResolvedHomeMaterial, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ERA_FALLBACK } from '@/shared/modules/construction/core/constants/era-defaults'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { homeAge } from '@/shared/modules/construction/core/lib/home-age'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'
import { wearForAge } from '@/shared/modules/construction/core/lib/wear-for-age'

export function bandsOf(id: HomeMaterialId, property: PropertyProfile): AgeBands {
  const { bands } = HOME_MATERIALS[id]
  return id === 'roof' ? bands[property.roofType ?? 'shingle'] : bands.all
}

// Unset counts as Worn wherever wear is read: offers, upkeep, the look and rain.
export function wearInForce(material: ResolvedHomeMaterial): Wear {
  return material.wear ?? 'worn'
}

function appliesTo(definition: HomeMaterialDefinition, property: PropertyProfile): boolean {
  if (definition.appliesTo) {
    return definition.appliesTo(property)
  }
  return definition.parts.every(({ assembly }) => ASSEMBLIES[assembly].appliesTo?.(property) ?? true)
}

function recordedOption(definition: HomeMaterialDefinition, facts: HomeFacts): string | null {
  const { property, materials } = facts
  switch (definition.replaceable) {
    case 'insulationLevel': return property.insulationLevel
    case 'windowsType': return property.windowsType
    case 'exteriorPaint': return materials.exteriorPaint
    case 'ducts': return materials.ducts
    case 'crawlInsulation': return materials.crawlInsulation
    case null: return null
  }
}

function resolveOne(id: HomeMaterialId, facts: HomeFacts): ResolvedHomeMaterial {
  const definition = HOME_MATERIALS[id]
  const { property } = facts
  const era = property.yearBuilt ?? ERA_FALLBACK
  const recorded = recordedOption(definition, facts)
  const guess = definition.eraGuess?.[era] ?? null

  let option: string | null
  let optionBasis: ResolvedHomeMaterial['optionBasis']
  if (id === 'roof') {
    option = property.roofType
    optionBasis = option === null ? null : 'recorded'
  }
  else if (recorded !== null) {
    option = recorded
    optionBasis = 'recorded'
  }
  else {
    option = guess
    optionBasis = guess === null ? null : 'era-typical'
  }

  // Era insulation is a guess about attic floors; under a flat roof the joist space is unknown, so there is none until it is recorded.
  const lowSlopeUnknown = id === 'attic-insulation' && recorded === null && roofFormOf(property.roofType ?? 'shingle') === 'low-slope'
  if (lowSlopeUnknown) {
    option = null
    optionBasis = null
  }
  const absent = lowSlopeUnknown || ((id === 'attic-insulation' || id === 'crawl-insulation') && option === 'none')
  if (absent) {
    return { id, option, optionBasis, wear: null, wearBasis: null, eraWear: null, absent: true }
  }

  const replacedAtSomePoint = recorded !== null && guess !== null && recorded !== guess
  const eraWear = replacedAtSomePoint ? null : wearForAge(bandsOf(id, property), homeAge(property.yearBuilt, facts.year))
  const setWear = facts.materials.wear[id]
  if (setWear) {
    return { id, option, optionBasis, wear: setWear, wearBasis: 'recorded', eraWear, absent: false }
  }
  return { id, option, optionBasis, wear: eraWear, wearBasis: eraWear === null ? null : 'era-typical', eraWear, absent: false }
}

export function resolveHomeMaterials(facts: HomeFacts): ResolvedHomeMaterials {
  const resolved: ResolvedHomeMaterials = {}
  for (const id of HOME_MATERIAL_IDS) {
    if (appliesTo(HOME_MATERIALS[id], facts.property)) {
      resolved[id] = resolveOne(id, facts)
    }
  }
  return resolved
}
