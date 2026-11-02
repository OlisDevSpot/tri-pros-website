// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { SceneSavings } from '@/features/trade-scenes/types'
import type { Resolved } from '@/shared/lib/resolve-overridable'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { useId } from 'react'

import { REPAIRS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { REPAIRS_TRADE_LABELS } from '@/features/trade-scenes/constants/repairs-trade-labels'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { formatAsDollars } from '@/shared/lib/formatters'
import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'

type SavingsReadAmountsProps = Pick<SceneSavings, 'cuts' | 'repairsByTrade'>

// Read-only, and no link back: switching to the existing build would also switch the scene to the existing home. Only the repairs rows
// Living situation edits show, so the hint stays true. Whole dollars, since the figures are cut from the rounded bill.
export function SavingsReadAmounts({ cuts, repairsByTrade }: SavingsReadAmountsProps) {
  const hintId = useId()
  const amounts = [
    ...SAVINGS_CATEGORIES.map(category => ({
      id: category,
      label: BILL_CATEGORY_LABELS[category],
      value: cuts[category].bill > 0 ? `${formatAsDollars(cuts[category].bill)}${SAVINGS_COPY.billSuffix}` : null,
    })),
    ...(Object.entries(repairsByTrade) as [TradeSlug, Resolved][]).flatMap(([trade, repairs]) => {
      const label = REPAIRS_TRADE_LABELS[trade]
      return label === undefined ? [] : [{ id: trade, label, value: `${formatAsDollars(repairs.value)}${SAVINGS_COPY.repairsSuffix}` }]
    }),
  ]

  return (
    <section aria-labelledby={hintId} className="grid gap-2">
      <p id={hintId} className="text-xs text-muted-foreground">{SAVINGS_COPY.readAmounts}</p>
      <ul className="flex flex-wrap gap-2">
        {amounts.map(amount => (
          <li key={amount.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-input bg-muted px-3 text-sm font-bold">
            {amount.label}
            {amount.value === null
              ? <span className="font-semibold text-muted-foreground">{REPAIRS_COPY.notSet}</span>
              : <span className="tabular-nums">{amount.value}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
