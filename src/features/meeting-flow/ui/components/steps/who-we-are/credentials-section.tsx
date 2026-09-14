'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { CredentialDocuments } from '@/features/meeting-flow/ui/components/steps/who-we-are/credential-documents'
import { PointHeading } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-heading'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'

interface CredentialsSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'credentials' }>
}

/**
 * Point 1: the license and certificate of insurance on the desk, then two tiers of
 * proof. Protection figures lead (what covers the homeowner); reputation follows,
 * smaller, under a hairline.
 */
export function CredentialsSection({ index, section }: CredentialsSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointLayout media={<CredentialDocuments documents={section.documents} />}>
        <PointHeading id={headingId} line={section.line} title={section.title} />

        <Reveal order={3}>
          <dl className="mt-[1cqh] flex flex-wrap gap-x-[4cqw] gap-y-[1.5cqh]">
            {section.protection.map(figure => (
              <div key={figure.label} className="grid">
                <dt className="order-last text-[max(2.2cqw,0.75rem)] text-white/60 lg:text-[max(1.3cqw,0.75rem)]">{figure.label}</dt>
                <dd className="font-sans text-[4.2cqw] leading-tight font-bold tracking-tight text-white tabular-nums lg:text-[2.7cqw]">
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal order={4}>
          <ul className="flex flex-wrap items-center gap-x-[3cqw] gap-y-[0.8cqh] border-t border-white/15 pt-[1.6cqh] text-[max(2.3cqw,0.8125rem)] lg:text-[max(1.35cqw,0.8125rem)]">
            {section.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
      </PointLayout>
    </SnapSection>
  )
}
