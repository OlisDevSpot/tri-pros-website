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
 * the compare spans the column and gives up height before the record does.
 */
export function PerformanceSection({ content, ...slide }: PerformanceSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<BeforeAfterCompare media={content.media} />} mediaHeight="own">
        <Reveal className="grid gap-presentation-tight" order={0}>
          <ProofRail rail={content.rail} />
          <ul className="flex flex-wrap items-center gap-x-[2.4cqw] gap-y-2 border-t border-white/10 pt-presentation-tight text-presentation-body">
            {content.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
