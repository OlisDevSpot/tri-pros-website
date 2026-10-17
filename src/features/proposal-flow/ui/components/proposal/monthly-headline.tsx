'use client'

import type { FinanceOption } from '@/shared/db/schema'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatAsDollars, numberToUSD } from '@/shared/lib/formatters'

interface Props {
  allCash: boolean
  finalTcp: number
  deposit: number
  financed: number
  /** The picked term, else the lowest monthly; null with no terms at all. */
  shown: FinanceOption | null
  picked: boolean
  loading: boolean
  monthlyFor: (option: FinanceOption) => number
}

export function MonthlyHeadline({ allCash, finalTcp, deposit, financed, shown, picked, loading, monthlyFor }: Props) {
  if (allCash) {
    return (
      <div className="grid gap-1 rounded-lg border border-border bg-band p-4">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Pay all cash</p>
        <p className="font-sans text-4xl leading-none tabular-nums">{formatAsDollars(finalTcp)}</p>
        <p className="text-sm text-muted-foreground">{`No loan. You pay ${formatAsDollars(deposit)} at signing, then the rest as the work is done, on the schedule below.`}</p>
      </div>
    )
  }
  if (!loading && shown === null) {
    return null
  }

  return (
    <div className="grid gap-1 rounded-lg border border-primary/20 bg-row-selected p-4">
      <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{picked ? 'Your monthly payment' : 'Monthly payments from'}</p>
      {loading || shown === null
        ? <Skeleton className="h-9 w-48" />
        : (
            <>
              <p className="leading-none tabular-nums">
                <span className="font-sans text-4xl tracking-[-0.02em]">{numberToUSD(monthlyFor(shown))}</span>
                <small className="text-base font-bold text-muted-foreground"> / mo</small>
              </p>
              <p className="text-sm text-muted-foreground">
                {picked
                  ? `${shown.termInMonths / 12} years · ${(shown.interestRate * 100).toFixed(2)}% APR · ${formatAsDollars(financed)} financed`
                  : `with the ${shown.termInMonths / 12}-year term · ${formatAsDollars(financed)} financed`}
              </p>
            </>
          )}
    </div>
  )
}
