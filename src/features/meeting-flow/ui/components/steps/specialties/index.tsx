'use client'

import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { ProjectStrip } from '@/features/meeting-flow/ui/components/steps/specialties/project-strip'
import { StepIntro } from '@/features/meeting-flow/ui/components/steps/specialties/step-intro'
import { TradeCatalog } from '@/features/meeting-flow/ui/components/steps/specialties/trade-catalog'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

/**
 * Step 2 of the meeting flow. Composition only: the model and the open trade
 * live in `TradeSelectionProvider`; the sheet is mounted by the view.
 * `StartHint` is not rendered until lead panels exist (Task 9): without lead data it
 * would claim "Nothing requested on this lead." on every meeting.
 */
function SpecialtiesStepImpl() {
  const { catalog } = useTradeCatalogContext()

  if (catalog.isLoading) {
    return <LoadingState description={SPECIALTIES_COPY.catalogLoading.description} title={SPECIALTIES_COPY.catalogLoading.title} />
  }

  if (catalog.error) {
    return (
      <div className="flex flex-col items-center gap-3">
        <ErrorState description={SPECIALTIES_COPY.catalogError.description} title={SPECIALTIES_COPY.catalogError.title} />
        <Button size="sm" variant="outline" onClick={catalog.refetch}>{SPECIALTIES_COPY.retry}</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <StepIntro hasLead={false} />
      <ProjectStrip />
      <TradeCatalog hasLead={false} />
    </div>
  )
}

/** No props: view re-renders (a save, the realtime echo) never reach the step; only its contexts do. */
export const SpecialtiesStep = memo(SpecialtiesStepImpl)
