'use client'

import type { Ref } from 'react'
import type { PresentationAgent, WhoWeAreContent } from '@/features/meeting-flow/types'
import type { IndexedSlide, PresentationHandle } from '@/shared/components/presentation/types'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { PROOF_POINT_COUNT, WHO_WE_ARE_GROUPS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { AgentSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-section'
import { ClosingSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/closing-section'
import { ComparisonSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-section'
import { CredentialsSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/credentials-section'
import { PointSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-section'
import { SampleSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/sample-section'
import { TeamSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/team-section'
import { Presentation } from '@/shared/components/presentation/presentation'
import { Slide } from '@/shared/components/presentation/slide'
import { SlideRun } from '@/shared/components/presentation/slide-run'

interface WhoWeAreStepProps {
  /** The meeting owner, introduced as the homeowner's point of contact. */
  agent: PresentationAgent
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
  /** Slide navigation for the shell's key map; forwarded to the presentation. */
  ref?: Ref<PresentationHandle>
}

/**
 * Step 1 of the meeting flow: the due-diligence story (docs/sales/due-diligence-story.md)
 * as a presentation. The hook, one run of eight column slides sharing a heading column, and
 * the closing. The kind switch is exhaustive (L1); the `hero` slide is its heading and photo
 * alone. The shell reaches the engine only through its named props: the step-root marker
 * for focus, the key shortcuts, and the capsule clearance (spec C S9).
 */
export function WhoWeAreStep({ agent, onContinue, ref }: WhoWeAreStepProps) {
  const renderSlide = ({ slide, index, frame }: IndexedSlide<WhoWeAreContent>) => {
    const { content } = slide
    const props = { index, frame, id: slide.id, heading: slide.heading, background: slide.background }
    switch (content.kind) {
      case 'hero':
        return <Slide key={slide.id} {...props} />
      case 'credentials':
        return <CredentialsSection key={slide.id} {...props} content={content} />
      case 'sample':
        return <SampleSection key={slide.id} {...props} content={content} />
      case 'point':
        return <PointSection key={slide.id} {...props} content={content} />
      case 'agent':
        return <AgentSection key={slide.id} {...props} agent={agent} content={content} />
      case 'team':
        return <TeamSection key={slide.id} {...props} content={content} />
      case 'comparison':
        return <ComparisonSection key={slide.id} {...props} content={content} />
      case 'closing':
        return <ClosingSection key={slide.id} {...props} content={content} onContinue={onContinue} />
      default:
        throw new Error(`Unknown slide kind: ${content satisfies never}`)
    }
  }

  return (
    <Presentation
      ref={ref}
      clearBottom="var(--stage-clear-b)"
      keyShortcuts={KEY_SHORTCUTS.presentation}
      label="Who we are presentation"
      rootAttributes={{ 'data-step-root': true }}
    >
      {WHO_WE_ARE_GROUPS.map(group => group.kind === 'full'
        ? renderSlide(group.item)
        : (
            <SlideRun key={`run-${group.items[0].index}`} items={group.items} numberedTotal={PROOF_POINT_COUNT}>
              {group.items.map(renderSlide)}
            </SlideRun>
          ))}
    </Presentation>
  )
}
