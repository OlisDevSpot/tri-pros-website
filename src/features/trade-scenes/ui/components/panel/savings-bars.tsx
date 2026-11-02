// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { ComponentProps } from 'react'

import { SavingsBar } from '@/features/trade-scenes/ui/components/panel/savings-bar'

interface SavingsBarsProps {
  sources: readonly (Omit<ComponentProps<typeof SavingsBar>, 'max'> & { id: string })[]
}

// The bars share one scale, so each source reads against the others rather than against a fixed ceiling.
export function SavingsBars({ sources }: SavingsBarsProps) {
  const max = Math.max(...sources.map(source => source.monthly ?? 0))
  return (
    <ul className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-4">
      {sources.map(({ id, ...source }) => <SavingsBar key={id} {...source} max={max} />)}
    </ul>
  )
}
