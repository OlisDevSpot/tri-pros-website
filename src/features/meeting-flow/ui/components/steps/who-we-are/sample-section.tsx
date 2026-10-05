'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { DocumentStack } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-stack'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type SampleSectionProps = SlideProps<WhoWeAreContentOf<'sample'>>

/** Point 2: a sample scope of work fanned on the desk as a showcase of the detail, then its figure. */
export function SampleSection({ content, ...slide }: SampleSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<DocumentStack document={content.document} openLabel={content.openLabel} />}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
