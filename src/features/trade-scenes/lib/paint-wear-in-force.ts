import type { PaintWear } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { PAINT_WEAR_START } from '@/features/trade-scenes/constants/paint-wear'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// A level the rep set wins over the one the paint's Condition starts it at.
export function paintWearInForce(material: ResolvedHomeMaterial | undefined, recorded: Partial<PaintWear>): PaintWear {
  const wear = material ? wearInForce(material) : 'new'
  return wear === 'new' ? PAINT_WEAR_START.new : { ...PAINT_WEAR_START[wear], ...recorded }
}
