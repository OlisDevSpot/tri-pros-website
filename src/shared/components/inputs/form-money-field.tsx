'use client'

import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { InputGroup, InputGroupAddon, InputGroupText } from '@/shared/components/ui/input-group'
import { MoneyField } from '@/shared/components/ui/money-field'
import { cn } from '@/shared/lib/utils'

interface Props<T extends FieldValues> {
  control: Control<T>
  name: FieldPathByValue<T, number | null>
  label: string
  // An addon rather than MoneyField's inline suffix, so the unit still shows while the field is empty.
  suffix?: string
  hint?: string
  hideLabel?: boolean
  cents?: boolean
  placeholder?: string
}

export function FormMoneyField<T extends FieldValues>({ control, name, label, suffix, hint, hideLabel, cents, placeholder = '$0' }: Props<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 gap-1.5">
          <FormLabel className={cn('text-xs font-bold', hideLabel && 'sr-only')}>{label}</FormLabel>
          <InputGroup className="h-11">
            <FormControl>
              <MoneyField
                {...field}
                cents={cents}
                className="h-11 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                data-slot="input-group-control"
                placeholder={placeholder}
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
