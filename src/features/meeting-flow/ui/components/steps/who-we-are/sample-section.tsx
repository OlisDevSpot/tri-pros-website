'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { DocumentStack } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-stack'
import { PointHeading } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-heading'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'

interface SampleSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'sample' }>
}

/** Point 2: a sample scope of work fanned on the desk as a showcase of the detail, then the point's copy. */
export function SampleSection({ index, section }: SampleSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointLayout media={<DocumentStack document={section.document} openLabel={section.openLabel} />}>
        <PointHeading id={headingId} line={section.line} title={section.title} />
        <ProofFigure order={2} proof={section.proof} />
      </PointLayout>
    </SnapSection>
  )
}
