'use client'

import type { PresentationAgent, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { AgentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-card'
import { ContactTimeline } from '@/features/meeting-flow/ui/components/steps/who-we-are/contact-timeline'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

interface AgentSectionProps extends SlideProps<WhoWeAreContentOf<'agent'>> {
  /** The meeting owner: the homeowner's point of contact. */
  agent: PresentationAgent
}

/**
 * Point 4: the agent in the room is the homeowner's line, from today to the final walkthrough.
 * Their card sits centred on the timeline, and what the homeowner can count on is under both.
 * A growth slide: on a short screen it grows rather than crowd the rail.
 */
export function AgentSection({ content, agent, ...slide }: AgentSectionProps) {
  const firstName = agent.name.split(' ')[0]

  return (
    <Slide {...slide}>
      <GrowthLayout className="grid-rows-[1fr_auto] gap-presentation-zone">
        <div className="grid content-center justify-items-center gap-presentation-zone">
          <Reveal data-agent-card order={0}>
            <AgentCard agent={agent} role={content.cardRole} />
          </Reveal>
          <Reveal className="w-full" order={1}>
            <ContactTimeline firstName={firstName} label={content.timelineLabel} stages={content.timeline} />
          </Reveal>
        </div>
        <Reveal order={2}>
          <ProofRail rail={content.rail} />
        </Reveal>
      </GrowthLayout>
    </Slide>
  )
}
