'use client'

import type { Ref } from 'react'
import type { PresentationAgent, PresentationHandle } from '@/features/meeting-flow/types'
import { WHO_WE_ARE_PINNED, WHO_WE_ARE_SECTIONS } from '@/features/meeting-flow/constants/who-we-are-sections'
import { PinnedColumn } from '@/features/meeting-flow/ui/components/presentation/pinned-column'
import { SnapPresentation } from '@/features/meeting-flow/ui/components/presentation/snap-presentation'
import { AgentSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-section'
import { ComparisonSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-section'
import { CredentialsSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/credentials-section'
import { HookSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/hook-section'
import { PointSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-section'
import { SampleSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/sample-section'
import { TeamSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/team-section'
import { TruthSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/truth-section'

interface WhoWeAreStepProps {
  /** The meeting owner, introduced as the homeowner's point of contact. */
  agent: PresentationAgent
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
  /** Beat navigation for the shell's key map; forwarded to the presentation. */
  ref?: Ref<PresentationHandle>
}

/**
 * Step 1 of the meeting flow as a snapping scroll presentation of the
 * due-diligence story (docs/sales/due-diligence-story.md).
 */
export function WhoWeAreStep({ agent, onContinue, ref }: WhoWeAreStepProps) {
  return (
    <SnapPresentation ref={ref} aside={<PinnedColumn summaries={WHO_WE_ARE_PINNED} />} label="Who we are presentation">
      {WHO_WE_ARE_SECTIONS.map((section, index) => {
        switch (section.kind) {
          case 'hook':
            return <HookSection key={section.id} index={index} section={section} />
          case 'credentials':
            return <CredentialsSection key={section.id} index={index} section={section} />
          case 'sample':
            return <SampleSection key={section.id} index={index} section={section} />
          case 'point':
            return <PointSection key={section.id} index={index} section={section} />
          case 'agent':
            return <AgentSection key={section.id} agent={agent} index={index} section={section} />
          case 'team':
            return <TeamSection key={section.id} index={index} section={section} />
          case 'comparison':
            return <ComparisonSection key={section.id} index={index} section={section} />
          case 'truth':
            return <TruthSection key={section.id} index={index} section={section} onContinue={onContinue} />
          default:
            throw new Error(`Unknown section kind: ${section satisfies never}`)
        }
      })}
    </SnapPresentation>
  )
}
