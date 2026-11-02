import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { HOME_MATERIAL_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'

// The one material per trade that carries repairs, so a trade's figure reads under that material's name.
export const REPAIRS_TRADE_LABELS: Partial<Record<TradeSlug, string>> = Object.fromEntries(
  HOME_MATERIAL_IDS.filter(id => HOME_MATERIALS[id].repairs).map(id => [HOME_MATERIALS[id].trade, HOME_MATERIAL_LABELS[id]]),
)
