import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { Fragment } from 'react'

import { TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { formatUnitCost } from '@/features/calculators/scope-pricing-calculator/lib/format-unit-cost'
import { unitCostEntries } from '@/features/calculators/scope-pricing-calculator/lib/unit-cost-entries'

interface Props {
  config: ScopePricingConfig
  trades: PricingTrade[]
}

export function UnitCostsList({ config, trades }: Props) {
  return (
    <section aria-label="Unit Costs" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Unit Costs</h3>
      {trades.length === 0 && <p className="text-sm text-muted-foreground">Add a scope to see its Unit Costs.</p>}
      {trades.map(trade => (
        <div className="flex flex-col gap-1" key={trade}>
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{TRADE_LABELS[trade]}</h4>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            {unitCostEntries(config, trade).map(entry => (
              <Fragment key={entry.key}>
                <dt>{entry.label}</dt>
                <dd className="text-right tabular-nums">{formatUnitCost(entry.value)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
