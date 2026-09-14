'use client'

import type { PresentationAgent, WhoWeAreSection } from '@/features/meeting-flow/types'
import { CheckIcon } from 'lucide-react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { AgentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-card'
import { PointHeading } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-heading'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'

interface AgentSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'agent' }>
  /** The meeting owner: the homeowner's point of contact. */
  agent: PresentationAgent
}

/** Point 4: the agent in the room is the homeowner's line; their card, then what to expect from them. */
export function AgentSection({ index, section, agent }: AgentSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointLayout
        media={(
          <Reveal className="absolute inset-0 flex items-center" order={2}>
            <AgentCard agent={agent} role={section.cardRole} />
          </Reveal>
        )}
      >
        <PointHeading id={headingId} line={section.line} title={section.title} />
        <Reveal order={3}>
          <ul className="mt-[0.8cqh] grid gap-[0.9cqh] text-[max(2.5cqw,0.875rem)] text-white/85 lg:text-[max(1.5cqw,0.875rem)]">
            {section.commitments.map(commitment => (
              <li key={commitment} className="flex items-start gap-[0.6em]">
                <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
                {commitment}
              </li>
            ))}
          </ul>
        </Reveal>
      </PointLayout>
    </SnapSection>
  )
}
