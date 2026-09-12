'use client'

import { WHO_WE_ARE_PINNED, WHO_WE_ARE_SECTIONS } from '@/features/meeting-flow/constants/who-we-are-sections'
import { PinnedColumn } from '@/features/meeting-flow/ui/components/presentation/pinned-column'
import { SnapPresentation } from '@/features/meeting-flow/ui/components/presentation/snap-presentation'
import { CredentialsSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/credentials-section'
import { HookSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/hook-section'
import { PointSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-section'
import { TruthSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/truth-section'

interface WhoWeAreStepProps {
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
}

/**
 * Step 1 of the meeting flow as a snapping scroll presentation of the
 * due-diligence story (docs/sales/due-diligence-story.md).
 */
export function WhoWeAreStep({ onContinue }: WhoWeAreStepProps) {
  return (
    <SnapPresentation aside={<PinnedColumn summaries={WHO_WE_ARE_PINNED} />} label="Who we are presentation">
      {WHO_WE_ARE_SECTIONS.map((section, index) => {
        switch (section.kind) {
          case 'hook':
            return <HookSection key={section.id} index={index} section={section} />
          case 'credentials':
            return <CredentialsSection key={section.id} index={index} section={section} />
          case 'point':
            return <PointSection key={section.id} index={index} section={section} />
          case 'truth':
            return <TruthSection key={section.id} index={index} section={section} onContinue={onContinue} />
        }
        return null
      })}
    </SnapPresentation>
  )
}
