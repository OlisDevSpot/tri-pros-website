'use client'

import { awaitingProposalsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProposalSection } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section'
import { DashboardSeeAllLink } from '@/features/agent-dashboard/ui/components/dashboard-see-all-link'
import { ROOTS } from '@/shared/config/roots'

/**
 * Proposals module — two truthful, non-overlapping sections: "Out for signature"
 * (contract envelope out for signature) and "Sent — awaiting response" (proposal
 * sent, no contract yet). Each section header names the state, so the rows carry
 * no status badge. Each section reuses the exact query keys the dashboard route
 * prefetches (`awaitingProposalsInput` / `sentProposalsInput`), so both hydrate
 * instantly.
 */
export function DashboardProposals() {
  return (
    <DashboardModule
      title="Proposals"
      action={<DashboardSeeAllLink href={ROOTS.dashboard.proposals.root()} />}
    >
      <div className="flex flex-col gap-4">
        <DashboardProposalSection
          title="Out for signature"
          input={awaitingProposalsInput()}
          timeSince="contractSentAt"
          emptyMessage="None out for signature"
        />
        <DashboardProposalSection
          title="Sent — awaiting response"
          input={sentProposalsInput()}
          timeSince="sentAt"
          emptyMessage="Nothing sent awaiting a response"
        />
      </div>
    </DashboardModule>
  )
}
