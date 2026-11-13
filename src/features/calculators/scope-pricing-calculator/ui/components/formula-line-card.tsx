'use client'

import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { describeCustomLine } from '@/features/calculators/scope-pricing-calculator/lib/describe-custom-line'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { isCustomLine } from '@/features/calculators/scope-pricing-calculator/lib/is-custom-line'
import { LineActions } from '@/features/calculators/scope-pricing-calculator/ui/components/line-actions'
import { LinePrice } from '@/features/calculators/scope-pricing-calculator/ui/components/line-price'
import { VariableField } from '@/features/calculators/scope-pricing-calculator/ui/components/variable-field'
import { Card } from '@/shared/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { MoneyField } from '@/shared/components/ui/money-field'

interface Props {
  config: ScopePricingConfig
  index: number
  pricingKey: PricingKey
  result: QuoteLineResult | undefined
  onDuplicate: () => void
  onRemove: () => void
}

export function FormulaLineCard({ config, index, pricingKey, result, onDuplicate, onRemove }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const formula = FORMULAS[pricingKey]
  const custom = isCustomLine(result)
  const needs = result?.status === 'incomplete' ? result.needs : []

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{formula.label}</h3>
          <p className="text-sm text-muted-foreground">{formula.outcome}</p>
        </div>
        <LinePrice customHint={describeCustomLine(config)} result={result} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {formula.variables.map(key => (
          <VariableField flagged={needs.includes(key)} key={key} lineIndex={index} variableKey={key} />
        ))}
        {custom && (
          <FormField
            control={control}
            name={`lines.${index}.price`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <MoneyField {...field} className="h-11" placeholder="$0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      <LineActions onDuplicate={onDuplicate} onRemove={onRemove} />
    </Card>
  )
}
