'use client'

import { memo, useCallback, useId, useMemo, useRef, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { ProjectRow } from '@/features/meeting-flow/ui/components/project-section/project-row'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

/**
 * The panel's Project section (spec D3, D8). The row whose trade is on stage opens by itself; opening or
 * closing a row is the rep's choice until the stage trade changes. Removing a row moves focus to the next row
 * (or the heading) before it unmounts.
 */
function ProjectSectionImpl() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId } = useTradeStage()
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [choice, setChoice] = useState<{ stage: string | null, open: string | null } | null>(null)

  const onProject = selectedTradeSelections(selections)
  const scopeCount = onProject.reduce((total, entry) => total + itemCount(entry), 0)
  const idsKey = onProject.map(entry => entry.tradeId).join('|')
  const onProjectIds = useMemo(() => new Set(idsKey ? idsKey.split('|') : []), [idsKey])
  const expandedTradeId = choice && choice.stage === stageTradeId ? choice.open : stageTradeId

  const handleExpandedChange = useCallback((tradeId: string, open: boolean) => {
    setChoice({ stage: stageTradeId, open: open ? tradeId : null })
  }, [stageTradeId])

  const handleBeforeRemove = useCallback((tradeId: string) => {
    const triggers = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-project-row-trigger]') ?? [])]
    const index = triggers.findIndex(trigger => trigger.dataset.tradeId === tradeId)
    const target = triggers[index + 1] ?? triggers[index - 1] ?? headingRef.current
    target?.focus()
  }, [])

  if (catalog.isLoading) {
    return <LoadingState description={SPECIALTIES_COPY.catalogLoading.description} title={SPECIALTIES_COPY.catalogLoading.title} />
  }

  if (catalog.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <ErrorState description={SPECIALTIES_COPY.catalogError.description} title={SPECIALTIES_COPY.catalogError.title} />
        <Button className="h-11" variant="outline" onClick={catalog.refetch}>{SPECIALTIES_COPY.retry}</Button>
      </div>
    )
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 ref={headingRef} className="font-sans text-base font-semibold outline-none" id={headingId} tabIndex={-1}>{SPECIALTIES_COPY.panel.heading}</h3>
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {`${formatCount(onProject.length, SPECIALTIES_COPY.units.trade)} · ${formatCount(scopeCount, SPECIALTIES_COPY.units.scope)}`}
        </p>
      </div>
      {onProject.length === 0
        ? <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.panel.empty}</p>
        : (
            <ul ref={listRef} className="flex flex-col gap-3">
              {onProject.map((entry) => {
                const slug = catalog.tradesById.get(entry.tradeId)?.slug
                const pairedSlug = slug ? TRADE_PAIRINGS[slug]?.pairedSlug : undefined
                const pairedId = pairedSlug ? catalog.tradesBySlug.get(pairedSlug)?.id : undefined
                return (
                  <li key={entry.tradeId}>
                    <ProjectRow
                      entry={entry}
                      expanded={expandedTradeId === entry.tradeId}
                      pairedOnProject={pairedId ? onProjectIds.has(pairedId) : false}
                      onBeforeRemove={handleBeforeRemove}
                      onExpandedChange={handleExpandedChange}
                      onStage={stageTradeId === entry.tradeId}
                    />
                  </li>
                )
              })}
            </ul>
          )}
    </section>
  )
}

export const ProjectSection = memo(ProjectSectionImpl)
