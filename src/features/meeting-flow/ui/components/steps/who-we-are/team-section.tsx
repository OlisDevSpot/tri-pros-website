'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import Image from 'next/image'
import { CheckList } from '@/features/meeting-flow/ui/components/steps/who-we-are/check-list'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type TeamSectionProps = SlideProps<WhoWeAreContentOf<'team'>>

/**
 * Point 5: the senior partner who stays hands-on, and the office behind the partner. The
 * partner's portrait fills the media row; their commitments and the support staff figure sit
 * side by side under it. No team-photo slot until the photo exists (U10).
 */
export function TeamSection({ content, ...slide }: TeamSectionProps) {
  const { partner } = content
  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <figure className="absolute inset-y-0 left-0 aspect-[3/4] overflow-hidden rounded-md">
            <Image alt={`${partner.name}, ${partner.title}`} className="object-cover object-[50%_15%]" draggable={false} fill sizes="(min-width: 1024px) 24vw, 40vw" src={partner.image} />
            <figcaption
              className="absolute inset-x-0 bottom-0 grid gap-1 px-presentation-tight pt-presentation-zone pb-presentation-tight"
              style={{ background: 'linear-gradient(to top, var(--presentation-ground), transparent)' }}
            >
              <span className="font-sans text-presentation-body leading-tight font-semibold">{partner.name}</span>
              <span className="text-presentation-label text-white/70">{partner.title}</span>
            </figcaption>
          </figure>
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-x-[4cqw] gap-y-presentation-group">
          <Reveal order={0}>
            <CheckList items={partner.points} />
          </Reveal>
          <ProofFigure order={1} proof={content.proof} />
        </div>
      </PointLayout>
    </Slide>
  )
}
