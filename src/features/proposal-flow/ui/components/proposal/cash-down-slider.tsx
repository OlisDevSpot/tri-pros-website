'use client'

import { Label } from '@/shared/components/ui/label'
import { Slider } from '@/shared/components/ui/slider'
import { formatAsDollars } from '@/shared/lib/formatters'
import { CASH_DOWN_STEP } from '@/shared/modules/proposals/core/constants/financing'

interface Props { value: number, max: number, disabled?: boolean, onChange: (value: number) => void }

export function CashDownSlider({ value, max, disabled = false, onChange }: Props) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <Label id="cash-down-label" className="text-sm font-bold">Cash down</Label>
        <span className="text-2xl font-semibold tabular-nums">{formatAsDollars(value)}</span>
      </div>
      <Slider
        className="h-11"
        min={0}
        max={max}
        step={CASH_DOWN_STEP}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v ?? 0)}
        thumbProps={{ 'aria-labelledby': 'cash-down-label', 'aria-valuetext': formatAsDollars(value), 'className': 'size-5' }}
      />
      <div className="flex justify-between text-xs font-semibold tabular-nums text-muted-foreground">
        <span>{formatAsDollars(0)}</span>
        <span>{formatAsDollars(max)}</span>
      </div>
    </div>
  )
}
