import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'

import { GUTTER_COLORS } from '@/shared/modules/construction/core/constants/gutter-colors'

const hexOf = (id: (typeof GUTTER_COLORS)[number]['id']) => GUTTER_COLORS.find(color => color.id === id)!.hex

// What is up is Almond until the rep says otherwise; a build keeps that colour unless the rep picks a new one, and a home
// with nothing picked on either side gets White.
export function gutterHex(materials: Pick<HomeMaterialFacts, 'existingGutterColor' | 'proposedGutterColor'>, installed: boolean): string {
  if (!installed) {
    return hexOf(materials.existingGutterColor ?? 'almond')
  }
  return hexOf(materials.proposedGutterColor ?? materials.existingGutterColor ?? 'white')
}
