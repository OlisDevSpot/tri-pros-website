'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { CredentialDocuments } from '@/features/meeting-flow/ui/components/steps/who-we-are/credential-documents'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type CredentialsSectionProps = SlideProps<WhoWeAreContentOf<'credentials'>>

/**
 * Point 1: the license and certificate of insurance on the desk, then two tiers of
 * proof. Protection figures lead (what covers the homeowner); reputation follows,
 * smaller, under a hairline. The heading is the run's column's; the content carries none (U1).
 */
export function CredentialsSection({ content, ...slide }: CredentialsSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<CredentialDocuments documents={content.documents} />}>
        <Reveal order={0}>
          <dl className="flex flex-wrap gap-x-[4cqw] gap-y-presentation-tight">
            {content.protection.map(figure => (
              <div key={figure.label} className="grid">
                <dt className="order-last text-presentation-label text-white/60">{figure.label}</dt>
                <dd className="font-sans text-presentation-figure leading-tight font-bold tracking-tight text-white tabular-nums lining-nums">
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal order={1}>
          <ul className="flex flex-wrap items-center gap-x-[3cqw] gap-y-presentation-tight border-t border-white/15 pt-presentation-tight text-presentation-body">
            {content.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
