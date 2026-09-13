'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { PointMediaLayer } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer'

interface PointSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'point' }>
}

/** Beats 3–8: one due-diligence point. Media, the serif numeral, title, line, proof. */
export function PointSection({ index, section }: PointSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointMediaLayer media={section.media} />

      <Reveal className="absolute top-[3.5cqh] left-[6cqw]" order={0}>
        <span aria-hidden className="font-serif text-[22cqw] leading-[0.9] tracking-tight text-white/25 lg:text-[15cqw]">
          {section.number}
        </span>
      </Reveal>

      <div className="absolute inset-x-[6cqw] bottom-[max(6cqh,var(--stage-inset-b))] grid gap-[1.2cqh]">
        <Reveal order={1}>
          <h2
            className="max-w-[20ch] font-sans text-[6cqw] leading-[1.04] font-semibold tracking-tight text-balance lg:text-[4.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={2}>
          <p className="max-w-[42ch] text-[max(2.8cqw,0.875rem)] leading-snug text-white/80 lg:text-[max(1.95cqw,0.875rem)]">{section.line}</p>
        </Reveal>
        <Reveal className="mt-[1cqh] flex flex-wrap items-baseline gap-x-[1.5cqw] gap-y-1" order={3}>
          <span className="font-sans text-[5.5cqw] leading-none font-bold tracking-tight text-(--presentation-accent) tabular-nums lg:text-[4.2cqw]">
            {section.proof}
          </span>
          <span className="max-w-[30ch] text-[max(2.2cqw,0.75rem)] text-white/65 lg:text-[max(1.5cqw,0.75rem)]">{section.proofLabel}</span>
        </Reveal>
      </div>
    </SnapSection>
  )
}
