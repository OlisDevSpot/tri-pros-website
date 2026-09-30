'use client'

import type { AgingTradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { ReplacementProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useFormContext, useWatch } from 'react-hook-form'

import { PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { TRADE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { FormNumberField } from '@/shared/components/inputs/form-number-field'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Switch } from '@/shared/components/ui/switch'

interface Props {
  trade: AgingTradeKey
  config: RemodelRoiConfig
  replacement: ReplacementProjection | undefined
}

export function TradeRow({ trade, config, replacement }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const age = useWatch({ control, name: `trades.${trade}.current.ageYears` })
  const working = config.trades[trade].current
  const ageHint = age == null
    ? 'Leave blank if it isn\'t aging'
    : replacement
      ? `~${formatYears(replacement.installs[0].year)} left of ~${replacement.standardLifeYears}`
      : `Lasts past year ${PROJECTION_YEARS}, so waiting has nothing to replace`
  return (
    <div className="grid gap-2.5 rounded-lg bg-muted p-3">
      <p className="text-sm font-bold">{TRADE_LABELS[trade]}</p>
      {trade === 'hvac' && (
        <FormField
          control={control}
          name="trades.hvac.ducts"
          render={({ field }) => (
            <FormItem className="flex min-h-11 flex-row items-center justify-between gap-3">
              <FormLabel className="text-xs font-bold">New ducts too</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )}
        />
      )}
      <FormNumberField control={control} hint={ageHint} label="Current one's age" max={100} name={`trades.${trade}.current.ageYears`} suffix="yrs" />
      <div className="grid grid-cols-2 gap-2">
        <FormNumberField control={control} label="Same kind today" name={`trades.${trade}.current.likeForLikePrice`} placeholder={working.likeForLikePrice.toLocaleString('en-US')} prefix="$" />
        <FormNumberField control={control} label="Repairs" name={`trades.${trade}.current.repairsPerYear`} placeholder={working.repairsPerYear.toLocaleString('en-US')} prefix="$" suffix="/yr" />
      </div>
    </div>
  )
}
