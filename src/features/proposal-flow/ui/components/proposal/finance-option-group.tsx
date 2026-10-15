'use client'

import type { FinanceOption } from '@/shared/db/schema'

import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'

interface Props {
  options: FinanceOption[]
  selectedId: number | null
  amountFinanced: number
  disabled?: boolean
  onSelect: (optionId: number) => void
}

export function FinanceOptionGroup({ options, selectedId, amountFinanced, disabled = false, onSelect }: Props) {
  // Radix radio values are strings; option ids are numbers.
  function select(next: string) {
    const option = options.find(o => String(o.id) === next)
    if (option) {
      onSelect(option.id)
    }
  }

  return (
    <RadioGroup aria-label="Finance option" value={selectedId === null ? '' : String(selectedId)} disabled={disabled} onValueChange={select} className="gap-2">
      {options.map((option) => {
        const id = `finance-option-${option.id}`
        const checked = option.id === selectedId
        return (
          // The whole row is the item's label, so a press anywhere on it picks the option.
          <Label
            key={option.id}
            htmlFor={id}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-4 font-normal leading-normal transition-colors hover:bg-row-hover pressed:bg-row-press',
              checked && 'bg-row-selected hover:bg-row-selected',
              disabled && 'cursor-not-allowed',
              disabled && !checked && 'hover:bg-card',
            )}
          >
            <RadioGroupItem id={id} value={String(option.id)} />
            <span className="grid flex-1">
              <span className="font-bold">{`${option.termInMonths / 12} years`}</span>
              <span className="text-xs text-muted-foreground">{`${option.termInMonths} months · ${Math.round(option.interestRate * 10000) / 100}% APR`}</span>
            </span>
            <span className="tabular-nums">
              <span className="text-lg font-semibold">{getLoanValues(amountFinanced, option.interestRate, option.termInMonths).monthlyFormatted}</span>
              <span className="text-xs text-muted-foreground"> / mo</span>
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
