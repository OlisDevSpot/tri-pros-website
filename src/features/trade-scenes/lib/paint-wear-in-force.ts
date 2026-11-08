import type { PaintWear } from '@/features/trade-scenes/types'
import type { PaintWearLevel } from '@/shared/modules/construction/core/constants/enums'
import type { ResolvedHomeMaterial, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { PAINT_WEAR_START } from '@/features/trade-scenes/constants/paint-wear'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// A level the rep set wins over the one the paint's Condition starts it at.
export function paintWearInForce(material: ResolvedHomeMaterial | undefined, recorded: Partial<PaintWear>): PaintWear {
  const wear = material ? wearInForce(material) : 'new'
  return wear === 'new' ? PAINT_WEAR_START.new : { ...PAINT_WEAR_START[wear], ...recorded }
}

// The fascia rot in force on the home's paint: what the replacement is offered for and the trim's row describes.
export function fasciaRotInForce(home: ResolvedHomeMaterials, recorded: Partial<PaintWear>): PaintWearLevel {
  return paintWearInForce(home['exterior-paint'], recorded)['fascia-rot']
}
