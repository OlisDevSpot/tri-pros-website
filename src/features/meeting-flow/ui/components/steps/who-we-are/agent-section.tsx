'use client'

import type { PresentationAgent, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { AgentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-card'
import { CheckList } from '@/features/meeting-flow/ui/components/steps/who-we-are/check-list'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

interface AgentSectionProps extends SlideProps<WhoWeAreContentOf<'agent'>> {
  /** The meeting owner: the homeowner's point of contact. */
  agent: PresentationAgent
}

/** Point 4: the agent in the room is the homeowner's line; their card, then what to expect from them. */
export function AgentSection({ content, agent, ...slide }: AgentSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <Reveal className="absolute inset-0 flex items-center" order={0}>
            <AgentCard agent={agent} role={content.cardRole} />
          </Reveal>
        )}
      >
        <Reveal order={1}>
          <CheckList items={content.commitments} />
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
