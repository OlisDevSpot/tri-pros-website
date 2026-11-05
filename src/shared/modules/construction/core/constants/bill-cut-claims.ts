import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

export interface BillCutClaimPicks {
  trades: readonly TradeSlug[]
  addOns: readonly BillCutAddOnId[]
}

// The team's working definition, not yet sourced: "heating and cooling" savings in copy means the envelope-plus-HVAC job, ducts included.
export const BILL_CUT_CLAIMS = {
  'heating-and-cooling': { trades: ['hvac', 'attic-and-basement', 'windows-and-doors'], addOns: ['ducts'] },
} as const satisfies Record<string, BillCutClaimPicks>

export type BillCutClaimId = keyof typeof BILL_CUT_CLAIMS
