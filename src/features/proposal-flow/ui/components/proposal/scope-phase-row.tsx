'use client'
// Step text repeats in real content, so index keys are the stable choice.
/* eslint-disable react/no-array-index-key */

import type { ParsedSowPhase } from '@/features/proposal-flow/lib/parse-sow-section'

import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { useIsStuck } from '@/features/proposal-flow/hooks/use-is-stuck'
import { cn } from '@/shared/lib/utils'

interface Props {
  phase: ParsedSowPhase
  index: number
  open: boolean
  stickyTop: number
  onToggle: (rowEl: HTMLLIElement) => void
}

export function ScopePhaseRow({ phase, index, open, stickyTop, onToggle }: Props) {
  const [button, setButton] = useState<HTMLButtonElement | null>(null)
  const stuck = useIsStuck(button, stickyTop)

  return (
    <li>
      <button
        ref={setButton}
        type="button"
        aria-expanded={open}
        onClick={e => onToggle(e.currentTarget.closest('li') as HTMLLIElement)}
        className={cn(
          'sticky top-[calc(var(--scope-eyebrow-h)+var(--scope-part-head-h))] z-1 grid min-h-12 w-full grid-cols-[26px_minmax(0,1fr)_auto_18px] items-center gap-2.5 bg-(--card) px-5 text-left text-base font-bold',
          'before:pointer-events-none before:absolute before:inset-0 before:bg-hover before:opacity-0 hover:before:opacity-100',
          stuck && 'shadow-[0_1px_0_var(--border)]',
        )}
      >
        <span className="relative font-sans text-sm leading-none font-bold text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <span className="relative min-w-0">{phase.title}</span>
        <small className="relative text-sm font-semibold text-muted-foreground">{`${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'}`}</small>
        <ChevronDownIcon className={cn('relative size-4 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
      </button>
      <div
        inert={!open}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className={cn('grid list-disc gap-1.5 pt-0.5 pr-5 pb-3.5 pl-[34px] text-base text-muted-foreground transition-opacity duration-200 @min-[700px]/proposal:pl-14 motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')}>
            {phase.steps.map((step, j) => <li key={j}>{step}</li>)}
          </ul>
        </div>
      </div>
    </li>
  )
}
