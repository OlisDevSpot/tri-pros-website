import type { InsulationLevel } from '@/shared/modules/construction/core/constants/enums'
import type { Basis, ExistingConditions, ExistingPart, HomeFacts, HomeMaterialFacts, PropertyProfile, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { ERA_FALLBACK } from '@/shared/modules/construction/core/constants/era-defaults'
import { COVERING_BY_ROOF, ERAS_WITH_DRIP_EDGE, EXACT_ROOFS, INSULATION_BY_LEVEL } from '@/shared/modules/construction/core/constants/roof-attic-inference'
import { drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

function basisFor(property: PropertyProfile): Basis {
  if (property.yearBuilt === null) {
    return 'typical'
  }
  const exact = property.roofType !== null && EXACT_ROOFS.includes(property.roofType) && property.insulationLevel !== null
  return exact ? 'recorded' : 'era-typical'
}

// A Good gutter is kept: it draws clean, so the card must not call it old.
function gutterPart(materials: HomeMaterialFacts, home: ResolvedHomeMaterials): ExistingPart {
  if (materials.gutters !== 'present') {
    return { material: null, condition: 'absent' }
  }
  const drawn = drawnPart('aluminum', home, 'roof')
  if (drawn.condition === 'absent') {
    return drawn
  }
  const wear = materials.gutterWear ?? drawn.wear
  return { material: 'aluminum', condition: wear === 'new' || wear === 'good' ? 'retained' : 'worn', wear }
}

// The rep says whether the openings are sealed; unset reads as open, the common case.
function airSealingPart(materials: HomeMaterialFacts): ExistingPart {
  return materials.airSealing === 'sealed' ? { material: 'sealed', condition: 'retained' } : { material: null, condition: 'absent' }
}

export function inferRoofAtticExistingConditions({ property, materials }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  const era = property.yearBuilt ?? ERA_FALLBACK
  const roofType = property.roofType ?? 'shingle'
  const insulation = home['attic-insulation']
  const insulationMaterial = insulation && !insulation.absent && insulation.option !== null ? INSULATION_BY_LEVEL[insulation.option as InsulationLevel] : null
  const deck = roofType === 'woodshake' ? 'spaced-boards' : 'plywood'

  return {
    form: roofFormOf(roofType),
    basis: basisFor(property),
    parts: {
      'ceiling': { material: 'drywall', condition: 'retained' },
      'air-sealing': airSealingPart(materials),
      'attic-insulation': insulationMaterial === null ? { material: null, condition: 'absent' } : drawnPart(insulationMaterial, home, 'attic-insulation'),
      'rafters': { material: 'lumber', condition: 'retained' },
      'radiant-barrier': { material: null, condition: 'absent' },
      'attic-fan': { material: null, condition: 'absent' },
      'deck': drawnPart(deck, home, 'roof'),
      'ice-and-water': { material: null, condition: 'absent' },
      'underlayment': drawnPart('felt', home, 'roof'),
      'drip-edge': ERAS_WITH_DRIP_EDGE.has(era) ? drawnPart('metal', home, 'roof') : { material: null, condition: 'absent' },
      // The existing roof is never cool: a cool covering is something the rep proposes.
      'covering': drawnPart(COVERING_BY_ROOF[roofType], home, 'roof'),
      'ridge-vent': { material: null, condition: 'absent' },
      'gutter': gutterPart(materials, home),
    },
  }
}
