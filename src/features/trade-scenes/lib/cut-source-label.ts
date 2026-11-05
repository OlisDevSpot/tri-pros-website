import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { CutSource } from '@/shared/modules/construction/core/types'

import { BILL_CUT_ADD_ON_IDS, BILL_CUT_ADD_ON_LABELS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'

function isAddOn(source: CutSource): source is BillCutAddOnId {
  const addOns: readonly string[] = BILL_CUT_ADD_ON_IDS
  return addOns.includes(source)
}

// Trades take the catalog's names, as the scope chips above the figure do; add-ons have no catalog row.
export function cutSourceLabel(source: CutSource, tradeName: (trade: TradeSlug) => string): string {
  return isAddOn(source) ? BILL_CUT_ADD_ON_LABELS[source] : tradeName(source)
}
