'use client'

import type * as React from 'react'

import { NumericFormat } from 'react-number-format'

import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'> {
  // Same contract as NumberField: `null` is the explicit clear, never `undefined`.
  value: number | null | undefined
  onChange: (value: number | null) => void
  cents?: boolean
  suffix?: string
}

export function MoneyField({ value, onChange, cents = false, suffix, ref, className, ...rest }: Props) {
  return (
    <NumericFormat
      {...rest}
      allowNegative={false}
      className={cn('tabular-nums', className)}
      customInput={Input}
      decimalScale={cents ? 2 : 0}
      getInputRef={ref}
      inputMode={cents ? 'decimal' : 'numeric'}
      onValueChange={(values, { source }) => {
        // A 'prop' change is the parent's own value coming back; echoing it would dirty the form on reset.
        if (source === 'event') {
          onChange(values.floatValue ?? null)
        }
      }}
      prefix="$"
      suffix={suffix}
      thousandSeparator
      value={value ?? ''}
    />
  )
}
