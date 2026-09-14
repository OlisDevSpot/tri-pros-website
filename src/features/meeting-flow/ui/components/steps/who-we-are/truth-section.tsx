'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { ArrowRightIcon } from 'lucide-react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'
import { Button } from '@/shared/components/ui/button'

interface TruthSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'truth' }>
  /** Advances the meeting flow to the next step. */
  onContinue: () => void
}

/**
 * The last beat: what most homeowners never think to ask, compared, then the closing
 * truth at a supporting size and the hand-off to the next step. In flow with a one-screen
 * minimum, like the comparison beat, so the longer table never clips the hand-off.
 */
export function TruthSection({ index, section, onContinue }: TruthSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <div className="grid min-h-[calc(100cqh-var(--pin-h))] content-center gap-[2.2cqh] px-[6cqw] pt-[4cqh] pb-[max(5cqh,var(--stage-inset-b))]">
        <Reveal order={0}>
          <h2
            className="font-sans text-[4.6cqw] leading-[1.06] font-semibold tracking-tight text-balance lg:text-[2.6cqw]"
            id={headingId}
          >
            {section.tableTitle}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <ComparisonTable density="compact" rows={section.rows} />
        </Reveal>
        <Reveal order={2}>
          <div className="flex flex-wrap items-center justify-between gap-x-[4cqw] gap-y-[1.6cqh] border-t border-white/15 pt-[2cqh]">
            <div className="grid max-w-[46ch] gap-[0.5cqh]">
              <h3 className="font-sans text-[3.6cqw] leading-tight font-medium tracking-tight lg:text-[1.9cqw]">{section.title}</h3>
              <p className="font-serif text-[max(2.4cqw,0.875rem)] leading-[1.4] text-white/80 italic lg:text-[max(1.2cqw,0.875rem)]">
                {section.quote}
              </p>
            </div>
            <Button className="min-h-11" size="lg" onClick={onContinue}>
              {section.ctaLabel}
              <ArrowRightIcon />
            </Button>
          </div>
        </Reveal>
      </div>
    </SnapSection>
  )
}
