'use client'

import type * as React from 'react'

import { NumberFormatBase, usePatternFormat } from 'react-number-format'

import { Input } from '@/shared/components/ui/input'
import { toDigits, toNationalDigits } from '@/shared/lib/phone'
import { cn } from '@/shared/lib/utils'

interface Props extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  value: string | null | undefined
  // Bare national digits, the same shape `customers.phone` stores, so a loaded row is never dirty.
  onChange: (digits: string) => void
}

export function PhoneField({ value, onChange, ref, className, placeholder = '(555) 123-4567', ...rest }: Props) {
  const { removeFormatting, ...formatProps } = usePatternFormat({
    ...rest,
    autoComplete: 'tel-national',
    className: cn('tabular-nums', className),
    customInput: Input,
    format: '(###) ###-####',
    getInputRef: ref,
    inputMode: 'tel',
    mask: '_',
    onValueChange: (values, { source }) => {
      if (source === 'event') {
        onChange(values.value)
      }
    },
    placeholder,
    type: 'tel',
    // Legacy rows can hold E.164 or a formatted string; the pattern only understands digits.
    value: toNationalDigits(value) ?? toDigits(value ?? ''),
    valueIsNumericString: true,
  })

  return (
    <NumberFormatBase
      {...formatProps}
      // A pasted "+1 818 …" carries the country code, which the pattern alone would read as the area code.
      removeFormatting={(input, changeMeta) => toNationalDigits(input) ?? removeFormatting?.(input, changeMeta) ?? toDigits(input)}
    />
  )
}
