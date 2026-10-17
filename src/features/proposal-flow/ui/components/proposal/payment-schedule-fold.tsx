'use client'

import type { PaymentScheduleRow } from '@/shared/modules/proposals/core/lib/financials'

import { ChevronDownIcon, ScaleIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { PAYMENT_DUE_COPY } from '@/features/proposal-flow/constants/funding-copy'
import { Button } from '@/shared/components/ui/button'
import { formatAsDollars, numberToUSD } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { PAYMENT_SCHEDULE_LAW_NOTE } from '@/shared/modules/proposals/core/constants/payment-schedule'

interface Props {
  schedule: PaymentScheduleRow[]
  finalTcp: number
}

// Each payment one step lighter than the last, so the bar and the ledger read in order.
function shade(index: number): string {
  return `color-mix(in oklab, var(--primary) ${100 - index * 15}%, var(--card))`
}

export function PaymentScheduleFold({ schedule, finalTcp }: Props) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  // Whole dollars read cleaner, but a price with cents shows them on every row so the column still adds up.
  const format = [finalTcp, ...schedule.map(row => row.amount)].some(amount => Math.round(amount * 100) % 100 !== 0) ? numberToUSD : formatAsDollars

  return (
    <div className="col-span-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-5 py-4.5 @min-[700px]/proposal:grid-cols-[20px_minmax(0,1fr)_auto] @min-[700px]/proposal:items-center">
        <ScaleIcon className="mt-0.5 size-4.5 text-primary @min-[700px]/proposal:mt-0" aria-hidden />
        <div className="grid gap-1">
          <h3 className="font-sans text-lg leading-tight font-medium">Payment schedule</h3>
          <p className="max-w-[62ch] text-sm text-muted-foreground">{PAYMENT_SCHEDULE_LAW_NOTE}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(current => !current)}
          className="col-start-2 mt-2 justify-self-start @min-[700px]/proposal:col-start-3 @min-[700px]/proposal:mt-0"
        >
          {`${open ? 'Hide' : 'See'} the ${schedule.length} payments`}
          <ChevronDownIcon className={cn('transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        </Button>
      </div>
      <div
        id={bodyId}
        inert={!open}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={cn('grid gap-3.5 border-t border-border px-5 pt-4.5 pb-5 transition-opacity duration-200 motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')}>
            <div role="img" aria-label="How the price splits across the payments" className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-border">
              {schedule.map((row, i) => <i key={row.key} className="block h-full" style={{ flex: row.amount, backgroundColor: shade(i) }} />)}
            </div>
            <div className="grid">
              <ol className="grid">
                {schedule.map((row, i) => (
                  <li key={row.key} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border py-3 text-base last:border-b-0">
                    <span className="size-2.5 self-center rounded-[3px]" style={{ backgroundColor: shade(i) }} aria-hidden />
                    <span className="min-w-0">
                      {row.label}
                      {row.percent !== null && <small className="ml-2 text-sm font-bold text-muted-foreground">{`${row.percent}%`}</small>}
                      <span className="block text-sm text-muted-foreground">{PAYMENT_DUE_COPY[row.due]}</span>
                    </span>
                    <span className="font-sans text-lg leading-none tabular-nums">{format(row.amount)}</span>
                  </li>
                ))}
              </ol>
              <p className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-3 border-t border-foreground pt-3 font-bold">
                <span aria-hidden />
                <span>Total</span>
                <span className="font-sans text-xl leading-none font-medium tabular-nums">{format(finalTcp)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
