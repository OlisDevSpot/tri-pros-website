'use client'
/* eslint-disable react-dom/no-dangerously-set-innerhtml */
// Parsed SOW content is static and read-only, and real content repeats strings, so index keys are the stable choice.
/* eslint-disable react/no-array-index-key */

import type { CSSProperties, ReactNode } from 'react'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { useMemo } from 'react'

import { useElementHeight } from '@/features/proposal-flow/hooks/use-element-height'
import { parseSowSection } from '@/features/proposal-flow/lib/parse-sow-section'
import { ScopePhaseList } from '@/features/proposal-flow/ui/components/proposal/scope-phase-list'
import { formatAsDollars } from '@/shared/lib/formatters'
import { sanitizeUserHtml } from '@/shared/lib/sanitize-html'

interface Props {
  section: SOW
  index: number
  showPrice: boolean
}

function Block({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="grid gap-2.5">
      <h4 className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</h4>
      {children}
    </div>
  )
}

function LineList({ lines }: { lines: string[] }) {
  return (
    <ul className="grid list-disc gap-1.5 pl-[18px] text-base text-muted-foreground">
      {lines.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  )
}

export function ScopeSpecCard({ section, index, showPrice }: Props) {
  const parsed = useMemo(() => parseSowSection(section.contentJSON), [section.contentJSON])
  const [headRef, headHeight] = useElementHeight<HTMLElement>()
  const price = section.financials.sectionPrice ?? 0

  return (
    <article
      id={`scope-part-${index + 1}`}
      className="scroll-mt-(--scope-eyebrow-h) overflow-clip rounded-xl border border-border bg-card"
      style={{ '--scope-part-head-h': `${headHeight}px` } as CSSProperties}
    >
      <header ref={headRef} className="sticky top-(--scope-eyebrow-h) z-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3.5 gap-y-1 border-b border-border bg-(--card) px-5 py-4.5">
        <span className="pt-0.5 font-sans text-xl leading-none text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0">
          <h3 className="font-sans text-xl font-medium text-balance">{section.title || 'Untitled part'}</h3>
          {section.trade.label && <small className="text-sm font-bold text-muted-foreground">{section.trade.label}</small>}
        </div>
        {showPrice && price > 0 && <span className="font-sans text-lg tabular-nums">{formatAsDollars(price)}</span>}
      </header>

      {!parsed
        ? <div className="proposal-sow px-5 py-4" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(section.html) }} />
        : (
            <div className="grid gap-5.5 px-5 pt-4.5 pb-5">
              {parsed.description && <p className="max-w-[62ch] text-base text-foreground">{parsed.description}</p>}

              {parsed.specs.length > 0 && (
                <Block label="Key details">
                  <dl className="grid border-t border-border @min-[760px]/proposal:grid-cols-2 @min-[760px]/proposal:gap-x-8">
                    {parsed.specs.map(([label, value], i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 border-b border-border py-2.25 text-base">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              )}

              {parsed.phases.length > 0 && (
                <ScopePhaseList phases={parsed.phases} partHeadHeight={headHeight} />
              )}

              {parsed.notes.length > 0 && <Block label="Notes"><LineList lines={parsed.notes} /></Block>}
              {parsed.exclusions.length > 0 && <Block label="Not included"><LineList lines={parsed.exclusions} /></Block>}
              {parsed.addOns.length > 0 && <Block label="Optional add-ons"><LineList lines={parsed.addOns} /></Block>}
            </div>
          )}
    </article>
  )
}
