import type { ExistingConditions, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { basisOfMaterials, drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'

export function inferCrawlSpaceExistingConditions({ property }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  return {
    form: null,
    basis: basisOfMaterials(property, home, ['crawl-insulation']),
    parts: {
      'subfloor': { material: 'plywood', condition: 'retained' },
      'floor-insulation': drawnPart('batts-r19', home, 'crawl-insulation'),
      'floor-joists': { material: 'lumber', condition: 'retained' },
      'foundation-vents': { material: 'screened-vent', condition: 'retained' },
      'vapor-barrier': { material: null, condition: 'absent' },
      'soil': { material: 'earth', condition: 'retained' },
    },
  }
}
