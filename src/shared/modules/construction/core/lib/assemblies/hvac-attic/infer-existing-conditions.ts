import type { ExistingConditions, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { basisOfMaterials, drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'

export function inferHvacAtticExistingConditions({ property }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  const ducts = home.ducts?.option ?? 'original-flex'
  return {
    form: property.hvacType === 'package-unit' ? 'package' : 'split',
    basis: basisOfMaterials(property, home, ['heating-cooling', 'ducts']),
    parts: {
      'air-handler': drawnPart('furnace-coil', home, 'heating-cooling'),
      'duct-runs': drawnPart(ducts, home, 'ducts'),
      'refrigerant-lines': drawnPart('copper', home, 'heating-cooling'),
      'condenser': property.hvacType !== 'package-unit' && property.hvacComponents === 'furnace' ? { material: null, condition: 'absent' } : drawnPart('standard-seer', home, 'heating-cooling'),
      'package-unit': drawnPart('standard-package', home, 'heating-cooling'),
    },
  }
}
