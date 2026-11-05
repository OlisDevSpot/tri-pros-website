import type { BillCategory } from '@/shared/modules/construction/core/constants/bill-categories'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { BillCutClaimId } from '@/shared/modules/construction/core/constants/bill-cut-claims'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { BILL_CUT_CLAIMS } from '@/shared/modules/construction/core/constants/bill-cut-claims'
import { combineCuts } from '@/shared/modules/construction/core/lib/combine-cuts'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'

// A compound figure is only ever "about": the nearest 5 is as fine as the working numbers go.
export function claimCutPercent(claim: BillCutClaimId, category: BillCategory): number {
  const { combined } = combineCuts(BILL_CUT_CLAIMS[claim], category, resolveTradeBillCuts())
  return Math.round(combined * 100 / 5) * 5
}

// The table's own row, as typed; only add-ons compound on top of it and leave a fraction to drop.
export function tradeCutPercent(trade: TradeSlug, category: BillCategory, addOns: readonly BillCutAddOnId[] = []): number {
  const cuts = resolveTradeBillCuts()
  if (addOns.length === 0) {
    return cuts[trade]?.base[category] ?? 0
  }
  const { combined } = combineCuts({ trades: [trade], addOns }, category, cuts)
  return Math.round(combined * 100)
}

export function formatCompoundClaim(percent: number): string {
  return `up to about ${percent}%`
}

export function formatRowClaim(percent: number): string {
  return `about ${percent}%`
}

export function formatCompoundTile(percent: number): string {
  return `Up to ~${percent}%`
}

export function formatRowTile(percent: number): string {
  return `–${percent}%`
}
