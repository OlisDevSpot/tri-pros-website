'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { BeforeAfterPair } from '@/features/meeting-flow/ui/components/steps/who-we-are/before-after-pair'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type PointSectionProps = SlideProps<WhoWeAreContentOf<'point'>>

/** A due-diligence point: its figure, over the slide's photo or under a before/after pair. */
export function PointSection({ content, ...slide }: PointSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={content.media ? <BeforeAfterPair media={content.media} /> : null}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
