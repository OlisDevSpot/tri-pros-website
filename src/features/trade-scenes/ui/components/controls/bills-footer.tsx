'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { Fragment, useId } from 'react'

import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { climateDefaultBill } from '@/features/trade-scenes/lib/climate-default-bill'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'
import { formatAsDollars } from '@/shared/lib/formatters'
import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'
import { CLIMATE_LABELS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'

// The bills Benefits will read. The climate here is the one Home facts' Area tab sets; until it is set the bills run on
// the inland defaults while the line says the area is missing. A cleared bill goes back to its climate's default.
export function BillsFooter() {
  const { billsOpen, toggleBills } = useSceneControls()
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const bills = useSceneInputs((state: TradeSceneInputs) => state.bills)
  const { savings } = useSceneTargets()
  const applyChange = useApplySceneChange()
  const rowId = useId()
  const fieldId = useId()
  const summary = CONTROLS_COPY.benefits.billsLine(
    climate === null ? CONTROLS_COPY.benefits.areaMissing : CLIMATE_LABELS[climate],
    savings.cuts.electric.bill,
    savings.cuts.gas.bill,
  )

  return (
    <div data-bills-footer className="grid shrink-0 gap-2.5 border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
      {billsOpen && (
        <div id={rowId} data-bills-edit className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <ChoicePill
            label={CONTROLS_COPY.facts.climate}
            value={climate}
            options={CLIMATES}
            labels={CLIMATE_LABELS}
            onChange={next => applyChange({ kind: 'climate', climate: next })}
          />
          {SAVINGS_CATEGORIES.map(category => (
            <Fragment key={category}>
              <label htmlFor={`${fieldId}-${category}`} className={CONTROLS_CLASSES.capsLabel}>{BILL_CATEGORY_LABELS[category]}</label>
              <UnitMoneyField
                compact
                id={`${fieldId}-${category}`}
                value={bills[category].now}
                placeholder={formatAsDollars(climateDefaultBill(climate, category))}
                unit={SAVINGS_COPY.billSuffix}
                onChange={now => applyChange({ kind: 'bill', category, now })}
              />
            </Fragment>
          ))}
          <span data-bill-source>
            {CONTROLS_COPY.benefits.billsSource(bills.electric.now !== null, bills.gas.now !== null, CLIMATE_LABELS[climate ?? CLIMATE_FALLBACK])}
          </span>
        </div>
      )}
      <div className="flex min-h-10 items-center gap-3">
        <span data-bills-summary className="min-w-0 flex-1">
          {CONTROLS_COPY.benefits.basedOn}
          {' '}
          <b className="text-foreground">{summary}</b>
        </span>
        {/* First in the window's focus order while the row is shut, so the window opens on it. */}
        <Button type="button" variant="link" data-bills-toggle aria-expanded={billsOpen} aria-controls={billsOpen ? rowId : undefined} onClick={toggleBills} className={CONTROLS_CLASSES.link}>
          {billsOpen ? CONTROLS_COPY.benefits.closeBills : CONTROLS_COPY.benefits.editBills}
        </Button>
      </div>
    </div>
  )
}
