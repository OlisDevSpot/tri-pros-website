'use client'

import { useId } from 'react'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useStageTrade } from '@/features/meeting-flow/hooks/use-stage-trade'
import { findStageMedia, selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'
import { ProjectProofStrip } from '@/features/meeting-flow/ui/components/steps/specialties/project-proof-strip'
import { ShowcaseFallback } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-fallback'
import { ShowcaseMedia } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-media'
import { ShowcaseText } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-text'

/**
 * The homeowner's column: pinned, never scrolls. Re-renders when the stage trade, the stage photo or the
 * catalog changes; a toggle re-renders only `ShowcaseText`.
 */
export function Showcase() {
  const trade = useStageTrade()
  const { catalog, projects } = useTradeCatalogContext()
  const { stageMediaKey } = useTradeStage()
  const titleId = useId()

  if (!trade) {
    return <section aria-hidden className="bg-(--presentation-ground)" />
  }

  const scopes = catalog.scopesByTrade.get(trade.id)?.scopes ?? []
  const current = findStageMedia(selectStageMedia(trade, scopes, projects), stageMediaKey)

  return (
    <section
      aria-labelledby={titleId}
      className="relative isolate min-h-0 overflow-hidden bg-(--presentation-ground) text-white @4xl/specialties:grid @4xl/specialties:grid-rows-[minmax(0,1fr)_auto]"
    >
      <div className="absolute inset-0 @4xl/specialties:relative @4xl/specialties:inset-auto @4xl/specialties:min-h-0">
        {current
          ? <ShowcaseMedia media={current} />
          : <ShowcaseFallback scopeNames={scopes.map(scope => scope.name)} />}
        <ProjectProofStrip currentKey={current?.key ?? null} projects={projects.byTrade.get(trade.id) ?? []} />
      </div>
      <ShowcaseText titleId={titleId} trade={trade} />
    </section>
  )
}
