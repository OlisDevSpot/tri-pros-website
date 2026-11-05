import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { Resolved } from '@/shared/lib/resolve-overridable'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { resolveOverridable } from '@/shared/lib/resolve-overridable'
import { REPAIRS_PER_YEAR, REPAIRS_SHARE_BY_WEAR } from '@/shared/modules/construction/core/constants/repairs-per-year'

// A material whose wear is not set costs what a Worn one does, as everywhere else wear is read.
export function workingRepairs(trade: TradeSlug, wear: Wear | null): number {
  const perYear: Partial<Record<TradeSlug, number>> = REPAIRS_PER_YEAR
  return Math.round((perYear[trade] ?? 0) * REPAIRS_SHARE_BY_WEAR[wear ?? 'worn'])
}

export function repairsFigure(entries: readonly { trade: TradeSlug, wear: Wear | null }[], overrides: TradeSceneInputs['repairsOverrides']): { byTrade: Partial<Record<TradeSlug, Resolved>>, monthly: number } {
  const byTrade: Partial<Record<TradeSlug, Resolved>> = {}
  let perYear = 0
  for (const { trade, wear } of entries) {
    const repairs = resolveOverridable(overrides[trade] ?? null, workingRepairs(trade, wear))
    byTrade[trade] = repairs
    perYear += repairs.value
  }
  return { byTrade, monthly: Math.round(perYear / 12) }
}
