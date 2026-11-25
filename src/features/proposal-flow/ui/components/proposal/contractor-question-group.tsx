'use client'

import type { RefObject } from 'react'
import type { CONTRACTOR_QUESTIONS } from '@/shared/constants/company'
import { CheckIcon, XIcon } from 'lucide-react'
import { RevealGroup } from '@/shared/components/reveal/reveal-group'
import { RevealItem } from '@/shared/components/reveal/reveal-item'
import { CONTRACTOR_COMPARISON_ROWS } from '@/shared/constants/company'

interface Props {
  question: (typeof CONTRACTOR_QUESTIONS)[number]
  number: number
  anchorId: string
  active: boolean
  rootRef: RefObject<Element | null>
}

export function ContractorQuestionGroup({ question, number, anchorId, active, rootRef }: Props) {
  return (
    <section id={anchorId} data-active={active} aria-labelledby={`${anchorId}-title`} className="group/question grid scroll-mt-[calc(var(--chips-h,0px)+12px)] gap-2.5">
      {/* On laptop the aside shows the title; the heading stays for screen readers. */}
      <h3 id={`${anchorId}-title`} className="flex items-baseline gap-2.5 font-sans text-xl leading-tight font-medium @min-[1100px]/proposal:sr-only">
        <span className="text-sm font-semibold text-primary">{number}</span>
        {question.title}
      </h3>
      <RevealGroup root={rootRef} className="grid gap-2.5">
        {question.rowIds.map((id) => {
          const row = CONTRACTOR_COMPARISON_ROWS[id]
          return (
            <RevealItem key={id}>
              {/* The dim lives inside the motion node: motion writes the item's opacity inline, which would beat a class on it. */}
              <div className="grid gap-1.5 rounded-xl border border-border bg-card px-4.5 py-4 transition-opacity duration-400 @min-[1100px]/proposal:motion-safe:group-data-[active=false]/question:opacity-30">
                <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{row.label}</p>
                <p className="flex items-baseline gap-2 font-sans text-lg leading-[1.35] font-medium">
                  <CheckIcon aria-hidden className="size-4.5 shrink-0 translate-y-0.75 text-status-success-fg" />
                  <span>{row.triPros}</span>
                </p>
                <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
                  <XIcon aria-hidden className="size-3.25 shrink-0 translate-y-px opacity-70" />
                  <span>{`Typical contractor: ${row.others}`}</span>
                </p>
              </div>
            </RevealItem>
          )
        })}
      </RevealGroup>
    </section>
  )
}
