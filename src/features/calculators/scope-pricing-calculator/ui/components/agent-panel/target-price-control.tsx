'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { describeTargetResult } from '@/features/calculators/scope-pricing-calculator/lib/describe-target-result'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  solved: SolveMultiplierResult | null
  floor: number
}

export function TargetPriceControl({ solved, floor }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <FormField
      control={control}
      name="agent.targetPrice"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Target price</FormLabel>
          <FormControl>
            <NumberField {...field} className="h-11" inputMode="decimal" min={0} placeholder="Total the homeowner should see" />
          </FormControl>
          <FormDescription>{describeTargetResult(solved, floor)}</FormDescription>
          <FormMessage />
          {field.value != null && (
            <Button className="min-h-11 self-start px-0" onClick={() => field.onChange(null)} type="button" variant="link">
              Clear the target
            </Button>
          )}
        </FormItem>
      )}
    />
  )
}
