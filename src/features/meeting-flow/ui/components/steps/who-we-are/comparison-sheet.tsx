'use client'

import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { Reveal } from '@/shared/components/presentation/reveal'
import { cn } from '@/shared/lib/utils'

interface ComparisonSheetProps {
  rows: ComparisonRow[]
  /** Which column of each row this sheet quotes. */
  side: 'triPros' | 'others'
}

/**
 * One quote on the desk: the detailed Tri Pros sheet, or the thin generic one with no
 * letterhead (C2). Row N reveals at stagger N on both sheets, so the pair lands together.
 */
export function ComparisonSheet({ rows, side }: ComparisonSheetProps) {
  const detailed = side === 'triPros'
  const Icon = detailed ? CheckIcon : XIcon
  return (
    <div
      className={cn(
        'grid gap-presentation-group rounded-md p-6 text-(--presentation-ground)',
        detailed ? 'bg-white shadow-2xl shadow-black/50' : 'bg-white/75',
      )}
      data-sheet={side}
    >
      <h3 className="font-sans text-presentation-label font-semibold tracking-[0.08em] uppercase">{COMPARISON_COLUMNS[side]}</h3>
      <ul className="grid gap-presentation-tight">
        {rows.map((row, position) => (
          <li key={row.label}>
            <Reveal className="grid gap-0.5" order={position}>
              <span className="text-presentation-label font-semibold text-(--presentation-ground)/70">{row.label}</span>
              <span className={cn('flex items-start gap-[0.6em] text-presentation-body', !detailed && 'text-(--presentation-ground)/80')}>
                <Icon aria-hidden className={cn('mt-[0.2em] size-[1em] shrink-0', !detailed && 'opacity-50')} />
                {row[side]}
              </span>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  )
}
