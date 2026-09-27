'use client'

import type { FieldPathByValue } from 'react-hook-form'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  name: FieldPathByValue<RemodelRoiFormValues, number | null>
  label: string
  suffix?: string
  min?: number
  max?: number
  step?: number
}

export function ProjectionNumberField({ name, label, suffix, min = 0, max, step }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{suffix ? `${label} (${suffix})` : label}</FormLabel>
          <FormControl>
            <NumberField {...field} className="h-11" inputMode="decimal" max={max} min={min} step={step} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
