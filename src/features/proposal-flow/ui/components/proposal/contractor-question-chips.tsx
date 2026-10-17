'use client'

import type { Ref, RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { CONTRACTOR_QUESTIONS } from '@/shared/constants/company'
import { cn } from '@/shared/lib/utils'
import { ContractorQuestionProgress } from './contractor-question-progress'

interface Props {
  ref: Ref<HTMLDivElement>
  activeIndex: number
  onSelect: (index: number) => void
  root: RefObject<HTMLElement | null>
  groupsRef: RefObject<HTMLDivElement | null>
}

export function ContractorQuestionChips({ ref, activeIndex, onSelect, root, groupsRef }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)

  // scrollIntoView would also move the page's vertical scroller; only the strip should move.
  useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.children[activeIndex] as HTMLElement | undefined
    if (!strip || !chip || !strip.offsetParent) {
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [activeIndex])

  return (
    <div ref={ref} className="sticky top-0 z-3 -mx-4.5 border-b border-border bg-background px-4.5 pt-2.5 @min-[700px]/proposal:-mx-10 @min-[700px]/proposal:px-10 @min-[700px]/proposal:pt-3 @min-[1100px]/proposal:hidden">
      <nav aria-label="Questions">
        <div ref={stripRef} className="relative flex gap-1.5 overflow-x-auto pb-2.5 scrollbar-none">
          {CONTRACTOR_QUESTIONS.map((question, i) => (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === activeIndex ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border-strong bg-card px-3.5 text-sm font-bold text-muted-foreground transition-colors pointer-coarse:min-h-11',
                i === activeIndex && 'border-foreground bg-foreground text-background',
              )}
            >
              <span className="font-sans text-xs font-semibold opacity-80">{i + 1}</span>
              {question.shortTitle}
            </button>
          ))}
        </div>
      </nav>
      <div aria-hidden className="-mx-4.5 h-0.75 bg-border @min-[700px]/proposal:-mx-10">
        {root.current && <ContractorQuestionProgress root={root} target={groupsRef} />}
      </div>
    </div>
  )
}
