import type { ShingleColorId } from '@/shared/modules/construction/core/types'

import { STANDARD_SHINGLES } from '@/shared/modules/construction/core/constants/standard-shingles'

// Each standard brown has a cool colour of the same look, so switching the cool roof keeps what the rep picked. A cool colour
// with no standard twin has nothing to carry over to, and clears.
export function shingleColorFor(colorId: ShingleColorId | null, cool: boolean): ShingleColorId | null {
  const standard = STANDARD_SHINGLES.find(color => color.id === colorId)
  if (standard) {
    return cool ? standard.coolTwin : standard.id
  }
  if (colorId === null || cool) {
    return colorId
  }
  return STANDARD_SHINGLES.find(color => color.coolTwin === colorId)?.id ?? null
}
