'use client'

import { proposalSteps } from '@/features/proposals/constants/proposal-steps'
import { ProposalPageNavbar } from '@/features/proposals/ui/components/proposal-page-navbar'

export default function ProposalPage() {
  return (
    <div className="h-screen flex flex-col">
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
