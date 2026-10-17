'use client'
// Phase titles and steps repeat in real content, so index keys are the stable choice.
/* eslint-disable react/no-array-index-key */

import type { ParsedSowPhase } from '@/features/proposal-flow/lib/parse-sow-section'

import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/shared/lib/utils'

interface Props {
  phases: ParsedSowPhase[]
}

export function ScopePhaseList({ phases }: Props) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]))

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(index)) {
        next.add(index)
      }
      return next
    })
  }

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {phases.map((phase, i) => {
        const isOpen = open.has(i)
        return (
          <li key={i}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
              className="grid min-h-12 w-full grid-cols-[26px_minmax(0,1fr)_auto_18px] items-center gap-2.5 px-3.5 text-left text-base font-bold transition-colors hover:bg-hover motion-reduce:transition-none"
            >
              <span className="font-sans text-sm leading-none font-bold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0">{phase.title}</span>
              <small className="text-sm font-semibold text-muted-foreground">{`${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'}`}</small>
              <ChevronDownIcon className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', isOpen && 'rotate-180')} aria-hidden />
            </button>
            <div
              inert={!isOpen}
              className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className={cn('grid list-disc gap-1.5 pt-0.5 pr-4 pb-3.5 pl-[50px] text-base text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none', isOpen ? 'opacity-100' : 'opacity-0')}>
                  {phase.steps.map((step, j) => <li key={j}>{step}</li>)}
                </ul>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
