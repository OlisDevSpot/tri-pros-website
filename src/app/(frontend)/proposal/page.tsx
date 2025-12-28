'use client'

import { Proposal } from '@/features/proposals/ui/components/proposal'
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
