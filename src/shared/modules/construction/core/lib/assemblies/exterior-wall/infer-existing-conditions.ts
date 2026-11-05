import type { ExistingConditions, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { basisOfMaterials, drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'

export function inferExteriorWallExistingConditions({ property }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  const paint = home['exterior-paint']?.option === 'cool' ? 'cool' : 'standard'
  return {
    form: 'stucco',
    basis: basisOfMaterials(property, home, ['exterior-paint']),
    parts: {
      'drywall': { material: 'drywall', condition: 'retained' },
      'studs': { material: 'lumber', condition: 'retained' },
      'cavity-insulation': { material: null, condition: 'absent' },
      'sheathing': { material: null, condition: 'absent' },
      'weather-barrier': { material: 'paper', condition: 'retained' },
      'lath': { material: 'wire', condition: 'retained' },
      'scratch-coat': { material: 'cement', condition: 'retained' },
      'brown-coat': { material: 'cement', condition: 'retained' },
      'finish': { material: 'stucco-finish', condition: 'retained' },
      'paint': drawnPart(paint, home, 'exterior-paint'),
    },
  }
}
