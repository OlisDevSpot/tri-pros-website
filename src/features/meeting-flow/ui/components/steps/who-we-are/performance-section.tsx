'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { BeforeAfterCompare } from '@/features/meeting-flow/ui/components/steps/who-we-are/before-after-compare'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type PerformanceSectionProps = SlideProps<WhoWeAreContentOf<'performance'>>

/**
 * Point 6: a room the homeowner can drag from before to after, then the record and the public
 * standing, each rating one tap from the reviews behind it. One screen like every other point:
 * the compare spans the column and gives up height before the record does. A phone-width
 * presentation has no height left for it, so there the slide is the record and the reviews.
 */
export function PerformanceSection({ content, ...slide }: PerformanceSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<BeforeAfterCompare className="@max-[30rem]/presentation:hidden" media={content.media} />} mediaHeight="own">
        <Reveal className="grid gap-presentation-group" order={0}>
          <ProofRail rail={content.rail} />
          <ul aria-label="Public reviews" className="grid grid-cols-3 gap-presentation-tight">
            {content.reputation.map(mark => <ReputationMark key={mark.platform} mark={mark} />)}
          </ul>
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
