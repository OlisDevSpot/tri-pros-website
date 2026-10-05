'use client'

import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { Showcase } from '@/features/meeting-flow/ui/components/steps/specialties/showcase'
import { WorkColumn } from '@/features/meeting-flow/ui/components/steps/specialties/work-column'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

/**
 * Step 2, `split` layout: the step owns two scrollers inside `StepRegion`. A container query on the stage's
 * own width (not the viewport, so the CRM sidebar counts): two columns at 896px (`@4xl`) and wider, a pinned
 * photo band above the work column below. No props, so view re-renders never reach it.
 */
function SpecialtiesStepImpl() {
  const { catalog } = useTradeCatalogContext()

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
    <div className="@container/specialties h-full">
      <div className="grid h-full grid-rows-[42%_minmax(0,1fr)] @4xl/specialties:grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)] @4xl/specialties:grid-rows-1">
        <Showcase />
        <WorkColumn />
      </div>
    </div>
  )
}

export const SpecialtiesStep = memo(SpecialtiesStepImpl)
