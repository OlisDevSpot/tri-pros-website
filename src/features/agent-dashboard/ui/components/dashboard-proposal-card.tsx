'use client'

import type { ProposalListRow } from '@/shared/entities/proposals/dal/server/queries'

import { mapProposalRowToCardData } from '@/features/agent-dashboard/lib/map-proposal-row-to-card-data'
import { ProposalOverviewCard } from '@/shared/entities/proposals/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface DashboardProposalCardProps {
  row: ProposalListRow
  /** Which timestamp the row's "time since" reflects: the contract went out (default) or the proposal was sent. */
  timeSince?: 'contractSentAt' | 'sentAt'
  className?: string
}

/**
 * Dense `ProposalOverviewCard` composition for the dashboard's proposal
 * rosters — the row leads with the label + compact actions up top (no status
 * badge; the section header names the state), trade/time-since/value/
 * view-count on a second line. Matches `DashboardMeetingCard`'s row
 * treatment (`rounded-lg border bg-card p-2.5`) so the dashboard's list
 * modules read as one visual family.
 */
export function DashboardProposalCard({ row, timeSince = 'contractSentAt', className }: DashboardProposalCardProps) {
  const proposal = mapProposalRowToCardData(row, timeSince)

  return (
    <ProposalOverviewCard
      proposal={proposal}
      className={cn('rounded-lg border border-border bg-card p-2.5', className)}
    >
      <ProposalOverviewCard.Header className="min-w-0 gap-1.5">
        <ProposalOverviewCard.Label className="min-w-0 flex-1 truncate font-medium" />
        <ProposalOverviewCard.Actions mode="compact" className="shrink-0" />
      </ProposalOverviewCard.Header>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <ProposalOverviewCard.Trade />
        <ProposalOverviewCard.CreatedAt format="relative" />
        <ProposalOverviewCard.Value className="text-sm" />
        <ProposalOverviewCard.ViewCount />
      </div>
    </ProposalOverviewCard>
  )
}
