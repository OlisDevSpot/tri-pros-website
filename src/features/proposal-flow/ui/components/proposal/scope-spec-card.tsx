'use client'
/* eslint-disable react-dom/no-dangerously-set-innerhtml */
// Parsed SOW content is static and read-only, and real content repeats strings, so index keys are the stable choice.
/* eslint-disable react/no-array-index-key */

import type { SOW } from '@/shared/modules/proposals/core/types'

import { ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { parseSowSection } from '@/features/proposal-flow/lib/parse-sow-section'
import { formatAsDollars } from '@/shared/lib/formatters'
import { sanitizeUserHtml } from '@/shared/lib/sanitize-html'
import { cn } from '@/shared/lib/utils'

// The parser leaves the free-text agreement notes as a trailing group; it is not a work phase.
const NOTES_TITLE = /^agreement notes$/i

interface Props {
  section: SOW
  index: number
  showPrice: boolean
}

export function ScopeSpecCard({ section, index, showPrice }: Props) {
  const parsed = useMemo(() => parseSowSection(section.contentJSON), [section.contentJSON])
  const phases = parsed?.phases.filter(phase => !NOTES_TITLE.test(phase.title)) ?? []
  const notes = parsed?.phases.filter(phase => NOTES_TITLE.test(phase.title)).flatMap(phase => phase.steps) ?? []
  const [openPhase, setOpenPhase] = useState<number | null>(0)
  const price = section.financials.sectionPrice ?? 0

  return (
    <article id={`scope-part-${index + 1}`} className="scroll-mt-12 overflow-hidden rounded-lg border border-border bg-card shadow-sm @min-[1100px]/proposal:scroll-mt-0">
      <header className="flex items-start gap-4 border-b border-border px-5 py-4">
        <span className="pt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-balance">{section.title || 'Untitled part'}</h3>
          {section.trade.label && <p className="text-xs font-semibold text-muted-foreground">{section.trade.label}</p>}
        </div>
        {showPrice && price > 0 && <span className="shrink-0 font-semibold tabular-nums">{formatAsDollars(price)}</span>}
      </header>

      {!parsed
        ? <div className="proposal-sow px-5 py-4" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(section.html) }} />
        : (
            <div className="grid gap-5 px-5 py-4">
              {parsed.description && <p className="text-sm leading-relaxed text-muted-foreground">{parsed.description}</p>}

              {parsed.specs.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key details</h4>
                  <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    {parsed.specs.map(([label, value], i) => (
                      <div key={i} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {parsed.exclusions.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Not included</h4>
                  <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                    {parsed.exclusions.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>
              )}

              {phases.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phases</h4>
                  <ol className="divide-y divide-border rounded-md border border-border">
                    {phases.map((phase, i) => {
                      const open = openPhase === i
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenPhase(open ? null : i)}
                            className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors hover:bg-row-hover pressed:bg-row-press"
                          >
                            <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0 flex-1">{phase.title}</span>
                            <span className="text-xs text-muted-foreground">{`${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'}`}</span>
                            <ChevronDownIcon className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                          </button>
                          {open && (
                            <ul className="grid list-disc gap-1 pb-3 pl-12 pr-3 text-sm text-muted-foreground">
                              {phase.steps.map((step, j) => <li key={j}>{step}</li>)}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {notes.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</h4>
                  <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                    {notes.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>
              )}

              {parsed.addOns.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Optional add-ons</h4>
                  <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                    {parsed.addOns.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
    </article>
  )
}
