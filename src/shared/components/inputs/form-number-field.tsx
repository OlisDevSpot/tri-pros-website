'use client'

import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { InputGroup, InputGroupAddon, InputGroupText } from '@/shared/components/ui/input-group'
import { NumberField } from '@/shared/components/ui/number-field'
import { cn } from '@/shared/lib/utils'

interface Props<T extends FieldValues> {
  control: Control<T>
  name: FieldPathByValue<T, number | null>
  label: string
  prefix?: string
  suffix?: string
  hint?: string
  hideLabel?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export function FormNumberField<T extends FieldValues>({ control, name, label, prefix, suffix, hint, hideLabel, min = 0, max, step, placeholder }: Props<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 gap-1.5">
          <FormLabel className={cn('text-xs font-bold', hideLabel && 'sr-only')}>{label}</FormLabel>
          <InputGroup className="h-11">
            {prefix && <InputGroupAddon><InputGroupText>{prefix}</InputGroupText></InputGroupAddon>}
            <FormControl>
              <NumberField
                {...field}
                className="h-11 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                data-slot="input-group-control"
                inputMode="decimal"
                max={max}
                min={min}
                placeholder={placeholder}
                step={step}
              />
            </FormControl>
            {suffix && <InputGroupAddon align="inline-end"><InputGroupText>{suffix}</InputGroupText></InputGroupAddon>}
          </InputGroup>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
