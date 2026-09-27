'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { LineActions } from '@/features/calculators/scope-pricing-calculator/ui/components/line-actions'
import { Card } from '@/shared/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  index: number
  onDuplicate: () => void
  onRemove: () => void
}

export function ManualLineCard({ index, onDuplicate, onRemove }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <Card className="gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <FormField
          control={control}
          name={`lines.${index}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input className="h-11" maxLength={80} placeholder="What this line covers" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`lines.${index}.price`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <NumberField {...field} className="h-11" inputMode="decimal" min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <LineActions onDuplicate={onDuplicate} onRemove={onRemove} />
    </Card>
  )
}
