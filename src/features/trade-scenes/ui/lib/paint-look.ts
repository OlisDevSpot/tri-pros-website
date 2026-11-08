import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { PaintHexes, PaintLook, PaintWear } from '@/features/trade-scenes/types'

import { PAINT_WEAR_START } from '@/features/trade-scenes/constants/paint-wear'
import { paintChalk } from '@/features/trade-scenes/ui/lib/paint-chalk'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

// Walls, gables, parapets, the raised foundation wall and the trim are painted surfaces, so they all read this one look. New paint,
// and the paint a Tri Pros build installs, shows none of the paint's own wear whatever levels were recorded, but a repaint never
// mends the fascia rot under it. The caller decides the colours.
export function paintLook(paint: PartState, paintWear: PaintWear, hexes: PaintHexes): PaintLook {
  return {
    color: wornColor(hexes.body, paintChalk(hexes.body), paint.wear),
    trim: wornColor(hexes.trim, paintChalk(hexes.trim), paint.wear),
    wear: paint.wear,
    paintWear: paint.wear === 0 ? { ...PAINT_WEAR_START.new, 'fascia-rot': paintWear['fascia-rot'] } : paintWear,
  }
}
