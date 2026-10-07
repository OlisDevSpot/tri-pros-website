'use client'

import type { PaymentMode, TermYears } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useQueryState } from 'nuqs'
import { useFormContext, useWatch } from 'react-hook-form'

import { calculatorTabParser } from '@/features/calculators/constants/query-parsers'
import { PAYMENT_MODE_LABELS, PAYMENT_MODES, TERM_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { FormNumberField } from '@/shared/components/inputs/form-number-field'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  projection: RemodelRoiProjection
  config: RemodelRoiConfig
}

export function ProjectSection({ projection, config }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const paymentMode = useWatch({ control, name: 'project.paymentMode' })
  const [, setTab] = useQueryState('tab', calculatorTabParser)
  return (
    <>
      <div className="grid gap-1">
        <FormNumberField control={control} label="Project price" name="project.price" prefix="$" />
        <button className="min-h-11 justify-self-start text-xs font-bold text-primary" onClick={() => setTab('scope-pricing')} type="button">Price it in Scope Pricing →</button>
      </div>
      <FormField
        control={control}
        name="project.paymentMode"
        render={({ field }) => (
          <FormItem className="gap-2">
            <FormLabel className="text-xs font-bold">How it's paid</FormLabel>
            <FormControl>
              <ToggleGroup className="w-full" onValueChange={value => value && field.onChange(value as PaymentMode)} type="single" value={field.value} variant="segmented">
                {PAYMENT_MODES.map(mode => <ToggleGroupItem className="h-9.5 flex-1" key={mode} value={mode}>{PAYMENT_MODE_LABELS[mode]}</ToggleGroupItem>)}
              </ToggleGroup>
            </FormControl>
          </FormItem>
        )}
      />
      {paymentMode === 'financed' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormNumberField control={control} label="APR" max={40} name="project.aprPercent" placeholder={String(config.defaultFinancing.aprPercent)} step={0.01} suffix="%" />
            <FormNumberField control={control} label="Down payment" name="project.downPayment" placeholder="0" prefix="$" />
          </div>
          <FormField
            control={control}
            name="project.termYears"
            render={({ field }) => (
              <FormItem className="gap-2">
                <FormLabel className="text-xs font-bold">Term</FormLabel>
                <FormControl>
                  <ToggleGroup className="w-full" onValueChange={value => value && field.onChange(Number(value) as TermYears)} type="single" value={String(field.value)} variant="segmented">
                    {TERM_YEARS.map(years => (
                      <ToggleGroupItem className="h-9.5 flex-1" key={years} value={String(years)}>
                        {years}
                        {' '}
                        yrs
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(projection.project.payment)}
                  /mo payment
                </p>
              </FormItem>
            )}
          />
        </>
      )}
      <FormNumberField control={control} label="Incentives" name="project.incentives" placeholder="0" prefix="$" />
    </>
  )
}
