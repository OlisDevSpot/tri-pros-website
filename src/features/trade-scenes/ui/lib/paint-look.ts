import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { PaintLook, PaintWear } from '@/features/trade-scenes/types'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_START } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

// Walls, gables, parapets and the raised foundation wall are one painted surface, so they all read this one look. New paint,
// and the paint a Tri Pros build installs, shows no paint wear whatever levels were recorded. The build's paint takes the
// build colour whichever paint goes on, until paint colour becomes its own pick.
export function paintLook(paint: PartState, paintWear: PaintWear, repainted: boolean): PaintLook {
  return {
    color: wornColor(repainted || paint.material === 'cool' ? HOME_PALETTE.paintCool : HOME_PALETTE.stucco, WEAR_LOOKS.paint.chalk, paint.wear),
    wear: paint.wear,
    paintWear: paint.wear === 0 ? PAINT_WEAR_START.new : paintWear,
  }
}
