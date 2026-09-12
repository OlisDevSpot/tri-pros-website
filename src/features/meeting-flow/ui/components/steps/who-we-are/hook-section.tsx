'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'

interface HookSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'hook' }>
}

/** Beat 1: the opening line over the finished-home photo. */
export function HookSection({ index, section }: HookSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <SectionImage alt={section.imageAlt} priority src={section.image} />
      <Scrim />
      <div className="absolute inset-x-[6cqw] bottom-[8cqh] grid gap-[1.5cqh] lg:bottom-[6cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[15ch] font-sans text-[8cqw] leading-[1.04] font-medium tracking-tight text-balance lg:text-[6.2cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <p className="font-serif text-[4.2cqw] italic lg:text-[3cqw]">
            {section.subtitle}
            {' '}
            <span className="text-(--presentation-accent)">{section.accent}</span>
          </p>
        </Reveal>
      </div>
    </SnapSection>
  )
}
