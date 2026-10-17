'use client'

import { ChevronRightIcon } from 'lucide-react'

import { useActiveChapter } from '@/features/proposal-flow/contexts/active-chapter-context'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { parseSowSection } from '@/features/proposal-flow/lib/parse-sow-section'
import { cn } from '@/shared/lib/utils'

export function OverviewParts() {
  const { proposal } = useProposalDocument()
  const { select } = useActiveChapter()
  const sow = proposal.projectJSON.data.sow

  return (
    <div className="grid gap-2.5">
      <p className="text-xs leading-tight font-bold tracking-[0.14em] text-muted-foreground uppercase">What’s in this proposal</p>
      {sow.length === 0
        ? <p className="text-muted-foreground">Scope being finalized.</p>
        : (
            <ol className={cn('grid gap-2', sow.length > 1 && '@min-[700px]/proposal:grid-cols-2')}>
              {sow.map((section, i) => {
                const phases = parseSowSection(section.contentJSON)?.phases.length
                const phaseCountLabel = phases === undefined ? null : `${phases} ${phases === 1 ? 'phase' : 'phases'}`
                return (
                  <li key={`part-${String(i + 1).padStart(2, '0')}`}>
                    {/* select, not a bare scroll: it marks Scope at once and holds the tracker until the jump lands. */}
                    <button
                      type="button"
                      data-press
                      onClick={() => select(`scope-part-${i + 1}`)}
                      className="grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-row-hover pressed:bg-row-press"
                    >
                      <span className="font-sans text-sm leading-none font-semibold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0">
                        <b className="block font-bold">{section.title || 'Untitled part'}</b>
                        <small className="text-sm text-muted-foreground">{[section.trade.label, phaseCountLabel].filter(Boolean).join(' · ')}</small>
                      </span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
    </div>
  )
}
