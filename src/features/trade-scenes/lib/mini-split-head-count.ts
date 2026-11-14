import type { MiniSplitHeadCount } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'

// The build's heads keep the home's own count until the rep picks another, and a count never set draws one head, so the
// choice shows pressed what the scene draws.
export function miniSplitHeadCount(materials: Pick<HomeMaterialFacts, 'miniSplitHeads' | 'proposedMiniSplitHeads'>, side: 'existing' | 'proposed'): MiniSplitHeadCount {
  return (side === 'proposed' ? materials.proposedMiniSplitHeads ?? materials.miniSplitHeads : materials.miniSplitHeads) ?? '1'
}
