'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

import { PAYMENT_MODES } from '@/features/proposal-flow/constants/payment-modes'
import { isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface Props { value: PaymentMode, finalTcp: number, disabled?: boolean, onChange: (mode: PaymentMode) => void }

export function PaymentPlanGroup({ value, finalTcp, disabled = false, onChange }: Props) {
  function select(next: string) {
    const mode = PAYMENT_MODES.find(m => m.value === next)
    if (mode) {
      onChange(mode.value)
    }
  }

  return (
    <RadioGroup aria-label="Payment plan" value={value} disabled={disabled} onValueChange={select} className="grid-cols-2 gap-2">
      {PAYMENT_MODES.map((mode) => {
        const id = `payment-mode-${mode.value}`
        const available = isPaymentModeAvailable(mode.value, finalTcp)
        const checked = value === mode.value
        const off = disabled || !available
        return (
          <Label
            key={mode.value}
            htmlFor={id}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold leading-normal transition-colors hover:bg-row-hover pressed:bg-row-press',
              checked && 'bg-row-selected hover:bg-row-selected',
              off && 'cursor-not-allowed',
              off && !checked && 'text-muted-foreground hover:bg-card',
            )}
          >
            <RadioGroupItem id={id} value={mode.value} disabled={!available} className="mt-0.5" />
            <span className="grid">
              {mode.label}
              {!available && <span className="text-xs font-semibold">Financing starts at $3,500</span>}
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
