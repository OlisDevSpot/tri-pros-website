'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { ArrowRightIcon } from 'lucide-react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { Button } from '@/shared/components/ui/button'

interface TruthSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'truth' }>
  /** Advances the meeting flow to the next step. */
  onContinue: () => void
}

/** Beat 9: the closing truth and the hand-off to the next step. */
export function TruthSection({ index, section, onContinue }: TruthSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <SectionImage alt={section.imageAlt} src={section.image} />
      <Scrim variant="heavy" />
      <div className="absolute inset-x-[8cqw] inset-y-0 grid content-center justify-items-start gap-[1.5cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[16ch] font-sans text-[6cqw] leading-[1.04] font-medium tracking-tight text-balance lg:text-[4.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <p className="max-w-[34ch] font-serif text-[3.6cqw] leading-[1.35] text-white/85 italic lg:text-[2.6cqw]">
            {section.quote}
          </p>
        </Reveal>
        <Reveal order={2}>
          <Button className="mt-[1cqh]" size="lg" onClick={onContinue}>
            {section.ctaLabel}
            <ArrowRightIcon />
          </Button>
        </Reveal>
      </div>
    </SnapSection>
  )
}
