'use client'

import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { CheckIcon } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'

import { createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { isAgingTrade, TRADE_KEYS, TRADE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { TradeRow } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/trade-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  projection: RemodelRoiProjection
  config: RemodelRoiConfig
}

export function TradesSection({ projection, config }: Props) {
  const { control, setValue } = useFormContext<RemodelRoiFormValues>()
  const trades = useWatch({ control, name: 'trades' })
  const picked = TRADE_KEYS.filter(trade => trades[trade] != null)
  return (
    <>
      <ToggleGroup
        aria-label="Trades in the project"
        className="flex-wrap justify-start gap-1.5"
        onValueChange={(next) => {
          for (const trade of TRADE_KEYS) {
            const on = next.includes(trade)
            if (on !== picked.includes(trade)) {
              setValue(`trades.${trade}`, on ? createTradePicks()[trade] : null, { shouldDirty: true, shouldValidate: true })
            }
          }
        }}
        type="multiple"
        value={picked}
      >
        {TRADE_KEYS.map(trade => (
          <ToggleGroupItem className="group min-h-11 flex-none gap-1.5 rounded-full border px-3.5 text-[13px] font-bold data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary" key={trade} value={trade}>
            <CheckIcon className="hidden size-3.5 group-data-[state=on]:block" />
            {TRADE_LABELS[trade]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-[12.5px] leading-snug text-muted-foreground">Bill cuts assume the energy-efficient version: cool roof, cool-life paint, turf. If the current one of a trade is aging, add its age: waiting means repairing it until it gives out, then paying that year's price.</p>
      {picked.filter(isAgingTrade).map(trade => <TradeRow config={config} key={trade} replacement={projection.replacements.find(replacement => replacement.trade === trade)} trade={trade} />)}
    </>
  )
}
