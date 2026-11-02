// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { SavingsCategory, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { REPAIRS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { repairsFigure } from '@/features/trade-scenes/lib/repairs-figure'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { CountedDollars } from '@/features/trade-scenes/ui/components/panel/counted-dollars'
import { RepairsRowField } from '@/features/trade-scenes/ui/components/panel/repairs-row-field'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Label } from '@/shared/components/ui/label'

// What running the home costs before any work; the build's savings are cut from these same bills. The repairs figure
// goes through the helper Savings uses, so a trade's figure is resolved and rounded the same way on both tabs, though
// Savings sums only the trades the build lands.
export function RepairsSection() {
  const bills = useSceneInputs((state: TradeSceneInputs) => state.bills)
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const overrides = useSceneInputs((state: TradeSceneInputs) => state.repairsOverrides)
  const { home } = useSceneTargets()
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const fieldId = useId()
  const hintId = useId()
  const repairsId = useId()
  const rows = repairsRows(property, home)
  const repairs = repairsFigure(rows, overrides)
  const monthly = (bills.electric.now ?? 0) + (bills.gas.now ?? 0) + repairs.monthly

  function setBill(category: SavingsCategory, next: number | null) {
    inputs.setState(state => ({ bills: { ...state.bills, [category]: { ...state.bills[category], now: next } } }))
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <ul className="grid divide-y divide-border *:py-2.5">
          {SAVINGS_CATEGORIES.map(category => (
            <li key={category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5">
              <Label htmlFor={`${fieldId}-${category}`} className="text-sm font-bold">{SAVINGS_COPY.billLabel(category)}</Label>
              <UnitMoneyField
                id={`${fieldId}-${category}`}
                cents
                value={bills[category].now}
                onChange={next => setBill(category, next)}
                unit={SAVINGS_COPY.billSuffix}
                aria-describedby={hintId}
              />
            </li>
          ))}
        </ul>
        <p id={hintId} className="text-xs text-muted-foreground">{SAVINGS_COPY.billHint}</p>
      </div>
      <section aria-labelledby={repairsId} className="grid">
        <p id={repairsId} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{SAVINGS_COPY.repairsLabel}</p>
        <ul className="grid divide-y divide-border *:py-2.5">
          {rows.map(row => <RepairsRowField key={row.material} row={row} />)}
        </ul>
      </section>
      <div className="grid gap-1 border-t border-border pt-3">
        <p className="flex items-baseline justify-between gap-2.5">
          <span className="text-sm font-semibold text-muted-foreground">{REPAIRS_COPY.total}</span>
          <span className="inline-flex shrink-0 items-baseline gap-1">
            <span className="font-sans text-2xl font-semibold"><CountedDollars value={monthly} /></span>
            <span className="text-xs font-bold text-muted-foreground">{REPAIRS_COPY.perMonth}</span>
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{REPAIRS_COPY.lead}</p>
      </div>
    </div>
  )
}
