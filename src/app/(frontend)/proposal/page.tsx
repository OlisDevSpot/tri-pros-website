'use client'

import { proposalSteps } from '@/features/proposals/constants/proposal-steps'
import { ProposalPageNavbar } from '@/features/proposals/ui/components/proposal-page-navbar'

export default function ProposalPage() {
  return (
    <div
      style={{
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      }}
      className="h-screen flex flex-col"
    >
      <ProposalPageNavbar />
      <div className="grow min-h-0 p-8">
        <Proposal />
      </div>
    </div>
  )
}

export function Proposal() {
  return (
    <div className="h-full overflow-auto scroll-smooth">
      <div className="container p-0 lg:p-0 pr-8 py-10 space-y-20">
        {proposalSteps.map(step => (
          <div
            id={step.accessor}
            key={step.accessor}
          >
            {step.Component}
          </div>
        ))}
      </div>
    </div>
  )
}
