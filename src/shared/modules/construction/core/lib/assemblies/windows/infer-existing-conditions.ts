import type { ExistingConditions, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { basisOfMaterials, drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'

export function inferWindowsExistingConditions({ property }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  const glazing = home.windows?.option === 'double' ? 'double-pane' : 'single-pane'
  return {
    form: null,
    basis: basisOfMaterials(property, home, ['windows']),
    parts: {
      glazing: drawnPart(glazing, home, 'windows'),
      frame: drawnPart('original-frame', home, 'windows'),
    },
  }
}
