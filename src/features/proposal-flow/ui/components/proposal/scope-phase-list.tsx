'use client'

import type { ParsedSowPhase } from '@/features/proposal-flow/lib/parse-sow-section'

import { useRef, useState } from 'react'

import { SCOPE_EYEBROW_H_PX } from '@/features/proposal-flow/constants/scope-sticky'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { allPhases, foldScrollDelta, isEveryPhaseOpen, togglePhase } from '@/features/proposal-flow/lib/scope-phase-open'
import { ScopePhaseRow } from '@/features/proposal-flow/ui/components/proposal/scope-phase-row'
import { ScopePhasesToggle } from '@/features/proposal-flow/ui/components/proposal/scope-phases-toggle'

interface Props {
  phases: ParsedSowPhase[]
  partHeadHeight: number
}

export function ScopePhaseList({ phases, partHeadHeight }: Props) {
  const { rootEl } = useScrollRoot()
  const wellRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => allPhases(phases.length))
  const stickyTop = SCOPE_EYEBROW_H_PX + partHeadHeight
  const allOpen = isEveryPhaseOpen(open, phases.length)

  function pullBackTo(el: Element) {
    if (!rootEl) {
      return
    }
    rootEl.scrollTop += foldScrollDelta(el.getBoundingClientRect().top - rootEl.getBoundingClientRect().top, stickyTop)
  }

  function toggleRow(index: number, rowEl: HTMLLIElement, wasStuck: boolean) {
    if (wasStuck && open.has(index)) {
      pullBackTo(rowEl)
    }
    setOpen(togglePhase(open, index))
  }

  function toggleAll() {
    if (allOpen) {
      if (wellRef.current) {
        pullBackTo(wellRef.current)
      }
      setOpen(new Set())
      return
    }
    setOpen(allPhases(phases.length))
  }

  return (
    <section ref={wellRef} className="surface-well -mx-5 border-y border-border pt-4">
      <div className="flex items-center justify-between gap-3 px-5 pb-2.5">
        <h4 className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">How we&apos;ll do it</h4>
        <ScopePhasesToggle allOpen={allOpen} onToggle={toggleAll} />
      </div>
      <ol className="[&>li+li]:border-t [&>li+li]:border-border">
        {phases.map((phase, i) => (
          // eslint-disable-next-line react/no-array-index-key -- phase titles repeat in real content
          <ScopePhaseRow key={i} phase={phase} index={i} open={open.has(i)} stickyTop={stickyTop} onToggle={(rowEl, wasStuck) => toggleRow(i, rowEl, wasStuck)} />
        ))}
      </ol>
    </section>
  )
}
