'use client'

import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { CutMode } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { BillCut } from '@/features/calculators/remodel-roi-calculator/types'

import { useFormContext, useWatch } from 'react-hook-form'

import { BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_SWATCH_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/bill-colors'
import { CUT_MODE_LABELS, CUT_MODES } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import { CUT_SOURCE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { FormNumberField } from '@/shared/components/inputs/form-number-field'
import { FormControl, FormField, FormItem } from '@/shared/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface Props {
  category: BillCategory
  cut: BillCut
}

export function BillRow({ category, cut }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const mode = useWatch({ control, name: `bills.${category}.cut.mode` })
  const label = BILL_CATEGORY_LABELS[category]
  return (
    <div className="grid gap-2 border-b border-dashed pb-3.5 last:border-b-0">
      <div className="flex items-end gap-3">
        <span aria-hidden className={cn('mb-4 size-2.5 shrink-0 rounded-full', BILL_SWATCH_CLASSES[category])} />
        <div className="min-w-0 flex-1"><FormNumberField control={control} label={label} name={`bills.${category}.now`} prefix="$" suffix="/mo" /></div>
        <div className="grid min-w-18 justify-items-end pb-2.5">
          <span className="text-xs font-bold">After</span>
          <b className="font-sans text-base font-semibold tabular-nums text-primary">{cut.bill ? formatMoney(cut.after) : '—'}</b>
        </div>
      </div>
      {cut.bill > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FormField
            control={control}
            name={`bills.${category}.cut.mode`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ToggleGroup aria-label={`${label} cut`} onValueChange={value => value && field.onChange(value as CutMode)} type="single" value={field.value} variant="outline">
                    {CUT_MODES.map(cutMode => <ToggleGroupItem className="h-11 flex-none px-3 text-xs" key={cutMode} value={cutMode}>{CUT_MODE_LABELS[cutMode]}</ToggleGroupItem>)}
                  </ToggleGroup>
                </FormControl>
              </FormItem>
            )}
          />
          {mode === 'trades'
            ? <p className="text-xs text-muted-foreground">{cut.parts.length ? `−${Math.round(cut.combined * 1000) / 10}% · ${cut.parts.map(part => CUT_SOURCE_LABELS[part.source]).join(', ')}` : 'No picked trade cuts this bill'}</p>
            : <div className="w-40"><FormNumberField control={control} hideLabel label={`${label} cut`} max={mode === 'percent' ? 100 : undefined} name={`bills.${category}.cut.value`} prefix={mode === 'amount' ? '$' : undefined} suffix={mode === 'percent' ? '%' : 'less/mo'} /></div>}
        </div>
      )}
    </div>
  )
}
