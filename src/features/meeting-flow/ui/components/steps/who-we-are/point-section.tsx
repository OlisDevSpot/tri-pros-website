'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type PointSectionProps = SlideProps<WhoWeAreContentOf<'point'>>

/** A due-diligence point whose photo is the slide's background: only its figure sits in the content. */
export function PointSection({ content, ...slide }: PointSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={null}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
