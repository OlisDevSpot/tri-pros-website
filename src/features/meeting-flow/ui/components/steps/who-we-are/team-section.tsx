'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { CheckIcon } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'
import { PointHeading } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-heading'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'

interface TeamSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'team' }>
}

/**
 * Point 5: the senior partner who stays hands-on, and the office behind him. His
 * portrait and the team photo share the media row; his commitments and the support
 * staff figure sit side by side under the heading.
 */
export function TeamSection({ index, section }: TeamSectionProps) {
  const headingId = `${section.id}-title`
  const { partner } = section
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointLayout
        media={(
          <div className="absolute inset-0 grid grid-cols-[2fr_3fr] gap-[2cqw]">
            <figure className="relative overflow-hidden rounded-md">
              <Image alt={`${partner.name}, ${partner.title}`} className="object-cover object-[50%_15%]" draggable={false} fill sizes="(min-width: 1024px) 24vw, 40vw" src={partner.image} />
              <figcaption
                className="absolute inset-x-0 bottom-0 grid gap-[0.2cqh] px-[1.6cqw] pt-[6cqh] pb-[1.4cqh]"
                style={{ background: 'linear-gradient(to top, var(--presentation-ground), transparent)' }}
              >
                <span className="font-sans text-[max(3cqw,0.9375rem)] leading-tight font-semibold lg:text-[max(1.7cqw,0.9375rem)]">{partner.name}</span>
                <span className="text-[max(2.2cqw,0.75rem)] text-white/70 lg:text-[max(1.2cqw,0.75rem)]">{partner.title}</span>
              </figcaption>
            </figure>
            <PlaceholderSlot label={section.teamPhotoLabel} />
          </div>
        )}
      >
        <PointHeading id={headingId} line={section.line} title={section.title} />
        <div className="flex flex-wrap items-end justify-between gap-x-[4cqw] gap-y-[1.5cqh]">
          <Reveal order={2}>
            <ul className="mt-[0.8cqh] grid gap-[0.9cqh] text-[max(2.5cqw,0.875rem)] text-white/85 lg:text-[max(1.45cqw,0.875rem)]">
              {partner.points.map(point => (
                <li key={point} className="flex items-start gap-[0.6em]">
                  <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <ProofFigure order={3} proof={section.proof} />
        </div>
      </PointLayout>
    </SnapSection>
  )
}
