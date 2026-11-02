'use client'

import { useId } from 'react'

import { InputGroup, InputGroupAddon, InputGroupText } from '@/shared/components/ui/input-group'
import { Label } from '@/shared/components/ui/label'
import { NumberField } from '@/shared/components/ui/number-field'
import { cn } from '@/shared/lib/utils'

interface UnitNumberFieldProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  hideLabel?: boolean
  suffix?: string
  max?: number
  placeholder?: string
  describedBy?: string
  className?: string
}

// The ROI calculator's FormNumberField, bound to the scene's store instead of a form: same field, 44 px tall for a tablet.
export function UnitNumberField({ label, value, onChange, hideLabel, suffix, max, placeholder, describedBy, className }: UnitNumberFieldProps) {
  const id = useId()
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <Label htmlFor={id} className={cn('text-xs font-bold', hideLabel && 'sr-only')}>{label}</Label>
      <InputGroup className="h-11">
        <NumberField
          id={id}
          value={value}
          onChange={onChange}
          aria-describedby={describedBy}
          className="h-11 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          data-slot="input-group-control"
          inputMode="decimal"
          min={0}
          max={max}
          placeholder={placeholder}
        />
        {suffix && <InputGroupAddon align="inline-end"><InputGroupText>{suffix}</InputGroupText></InputGroupAddon>}
      </InputGroup>
    </div>
  )
}
