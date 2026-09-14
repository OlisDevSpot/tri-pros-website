'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'

interface ComparisonSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'comparison' }>
}

/**
 * The six points recapped side by side: Tri Pros against other contractors. The content is
 * in flow with a one-screen minimum, so a cramped stage grows the beat instead of clipping it.
 */
export function ComparisonSection({ index, section }: ComparisonSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <div className="grid min-h-[calc(100cqh-var(--pin-h))] content-center gap-[3cqh] px-[6cqw] pt-[5cqh] pb-[max(6cqh,var(--stage-inset-b))]">
        <Reveal order={0}>
          <h2
            className="max-w-[22ch] font-sans text-[5.2cqw] leading-[1.06] font-semibold tracking-tight text-balance lg:text-[3.4cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <ComparisonTable density="regular" rows={section.rows} />
        </Reveal>
      </div>
    </SnapSection>
  )
}
