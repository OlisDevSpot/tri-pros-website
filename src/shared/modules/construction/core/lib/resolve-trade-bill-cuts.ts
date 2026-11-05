import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'

import { TRADE_BILL_CUTS } from '@/shared/modules/construction/core/constants/trade-bill-cuts'
import { tradeBillCutsSchema } from '@/shared/modules/construction/core/schemas/bill-cuts'

// Admin-set defaults have no storage yet, so the code defaults are the whole answer; this is the one seam
// that reads app settings once they exist, for the ROI calculator and the trade scenes alike.
export function resolveTradeBillCuts(): TradeBillCuts {
  return tradeBillCutsSchema.parse(TRADE_BILL_CUTS)
}
