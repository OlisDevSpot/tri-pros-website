'use client'

import { useId } from 'react'

import { Label } from '@/shared/components/ui/label'
import { Slider } from '@/shared/components/ui/slider'
import { formatAsDollars } from '@/shared/lib/formatters'
import { CASH_DOWN_PRESET_PERCENTS } from '@/shared/modules/proposals/core/constants/financing'
import { getCashDownPreset, nearestStopIndex } from '@/shared/modules/proposals/core/lib/financials'

interface Props {
  cash: number
  deposit: number
  finalTcp: number
  stops: number[]
  disabled: boolean
  onChange: (value: number) => void
}

export function CashDownControl({ cash, deposit, finalTcp, stops, disabled, onChange }: Props) {
  const labelId = useId()
  const sliderId = useId()
  const chips = [
    { key: 'deposit', label: 'Deposit', value: deposit, off: false },
    ...CASH_DOWN_PRESET_PERCENTS.map((percent) => {
      const preset = getCashDownPreset(percent, finalTcp, stops)
      return { key: String(percent), label: `${percent}% · ${formatAsDollars(preset.value)}`, value: preset.value, off: preset.disabled }
    }),
  ]

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label id={labelId} htmlFor={sliderId} className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Cash down</Label>
        <span className="font-sans text-xl leading-none tabular-nums">{formatAsDollars(cash)}</span>
      </div>
      <div role="group" aria-label="Quick cash down" className="flex flex-wrap gap-1.5 pt-1">
        {chips.map(chip => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.value === cash}
            disabled={disabled || chip.off}
            onClick={() => onChange(chip.value)}
            className="min-h-9 rounded-full border border-border-strong bg-card px-3 text-sm font-bold transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card aria-pressed:border-primary/45 aria-pressed:bg-row-selected aria-pressed:text-primary pointer-coarse:min-h-11"
          >
            {chip.label}
          </button>
        ))}
      </div>
      {stops.length > 1 && (
        <>
          <Slider
            className="h-11"
            min={0}
            max={stops.length - 1}
            step={1}
            value={[nearestStopIndex(cash, stops)]}
            disabled={disabled}
            onValueChange={([i]) => onChange(stops[i ?? 0]!)}
            thumbProps={{ 'id': sliderId, 'aria-labelledby': labelId, 'aria-valuetext': formatAsDollars(cash), 'className': 'size-5' }}
          />
          <div className="flex justify-between text-xs font-bold tabular-nums text-muted-foreground">
            <span>{`${formatAsDollars(deposit)} deposit`}</span>
            <span>{formatAsDollars(stops.at(-1)!)}</span>
          </div>
        </>
      )}
    </div>
  )
}
