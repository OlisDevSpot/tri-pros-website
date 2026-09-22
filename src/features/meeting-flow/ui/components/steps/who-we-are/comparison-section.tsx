'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type ComparisonSectionProps = SlideProps<WhoWeAreContentOf<'comparison'>>

/**
 * Tri Pros against other contractors: the six points, and the extras. A growth slide: the
 * content stays in flow with a one-screen minimum, so a comparison taller than the screen
 * makes the slide taller instead of being clipped (spec C §4.4, review F6).
 */
export function ComparisonSection({ content, ...slide }: ComparisonSectionProps) {
  return (
    <Slide {...slide}>
      <div className="grid min-h-[calc(100cqh-var(--band-h,0px))] content-center px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]">
        <Reveal order={0}>
          <ComparisonTable rows={content.rows} />
        </Reveal>
      </div>
    </Slide>
  )
}
