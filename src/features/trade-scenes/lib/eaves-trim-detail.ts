import type { PaintWearLevel } from '@/shared/modules/construction/core/constants/enums'

import { EAVES_TRIM_DETAILS } from '@/features/trade-scenes/constants/home-scene-copy'

// Only rot gives the trim a line of its own: a repaint covers it but never mends it.
export function eavesTrimDetail(rot: PaintWearLevel, replaced: boolean): string {
  if (rot === 'none') {
    return ''
  }
  return replaced ? EAVES_TRIM_DETAILS.replaced : EAVES_TRIM_DETAILS.rot
}
