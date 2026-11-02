// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import { SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CountedDollars } from '@/features/trade-scenes/ui/components/panel/counted-dollars'
import { EstimateDisclosure } from '@/features/trade-scenes/ui/components/panel/estimate-disclosure'

interface SavingsFigureProps {
  label: string
  monthly: number
  disclosure: readonly string[]
}

// "about $X a month less*": whole dollars, always an estimate, never a promise. It leads the tab, so the dollars are the
// largest type on it and the words around them step back.
export function SavingsFigure({ label, monthly, disclosure }: SavingsFigureProps) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm font-semibold text-muted-foreground">{SAVINGS_COPY.figure.before}</span>
        <span className="font-sans text-4xl leading-none font-semibold"><CountedDollars value={monthly} /></span>
        <span className="text-base font-semibold text-muted-foreground">
          {SAVINGS_COPY.figure.after}
          <EstimateDisclosure lines={disclosure} />
        </span>
      </p>
    </div>
  )
}
