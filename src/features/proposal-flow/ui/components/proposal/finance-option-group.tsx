'use client'

import type { FinanceOption } from '@/shared/db/schema'

import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { numberToUSD } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  options: FinanceOption[]
  selectedId: number | null
  monthlyFor: (option: FinanceOption) => number
  disabled?: boolean
  onSelect: (optionId: number) => void
}

export function FinanceOptionGroup({ options, selectedId, monthlyFor, disabled = false, onSelect }: Props) {
  // Radix radio values are strings; option ids are numbers.
  function select(next: string) {
    const option = options.find(o => String(o.id) === next)
    if (option) {
      onSelect(option.id)
    }
  }

  return (
    <RadioGroup aria-label="Loan term" value={selectedId === null ? '' : String(selectedId)} disabled={disabled} onValueChange={select} className="gap-2">
      {options.map((option) => {
        const id = `finance-option-${option.id}`
        const checked = option.id === selectedId
        return (
          // The whole row is the item's label, so a press anywhere on it picks the option.
          <Label
            key={option.id}
            htmlFor={id}
            className={cn(
              'grid min-h-14 cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 font-normal leading-normal transition-colors hover:bg-row-hover pressed:bg-row-press',
              checked && 'border-primary/40 bg-row-selected hover:bg-row-selected',
              disabled && 'cursor-not-allowed',
              disabled && !checked && 'hover:bg-card',
            )}
          >
            <RadioGroupItem id={id} value={String(option.id)} className="size-4.5" />
            <span className="grid min-w-0">
              <span className="font-bold">{`${option.termInMonths / 12} years`}</span>
              <span className="text-xs text-muted-foreground">{`${option.termInMonths} months · ${(option.interestRate * 100).toFixed(2)}% APR`}</span>
            </span>
            <span className="leading-none tabular-nums">
              <span className="font-sans text-lg">{numberToUSD(monthlyFor(option))}</span>
              <small className="text-xs font-semibold text-muted-foreground"> /mo</small>
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
