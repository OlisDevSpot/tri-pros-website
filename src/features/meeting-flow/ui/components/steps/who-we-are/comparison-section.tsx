'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type ComparisonSectionProps = SlideProps<WhoWeAreContentOf<'comparison'>>

/** Tri Pros against other contractors: the six points, and the extras. A growth slide, so a long table makes the slide taller instead of being clipped. */
export function ComparisonSection({ content, ...slide }: ComparisonSectionProps) {
  return (
    <Slide {...slide}>
      <GrowthLayout>
        <Reveal order={0}>
          <ComparisonTable rows={content.rows} />
        </Reveal>
      </GrowthLayout>
    </Slide>
  )
}
