import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { Basis, ExistingPart, PropertyProfile, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// A part a home material draws: kept only when new, otherwise it ages with the material.
export function drawnPart(material: string, home: ResolvedHomeMaterials, id: HomeMaterialId): ExistingPart {
  const resolved = home[id]
  if (!resolved || resolved.absent) {
    return { material: null, condition: 'absent' }
  }
  const wear = wearInForce(resolved)
  return { material, condition: wear === 'new' ? 'retained' : 'worn', wear }
}

// Without a year built nothing is known about the home; otherwise it is recorded only when every material read was.
export function basisOfMaterials(property: PropertyProfile, home: ResolvedHomeMaterials, ids: readonly HomeMaterialId[]): Basis {
  if (property.yearBuilt === null) {
    return 'typical'
  }
  return ids.every(id => home[id]?.optionBasis === 'recorded') ? 'recorded' : 'era-typical'
}
