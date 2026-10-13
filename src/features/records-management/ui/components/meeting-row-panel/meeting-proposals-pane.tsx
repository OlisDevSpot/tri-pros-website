'use client'

import type { CustomerProfileProposal } from '@/shared/entities/customers/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { computeScopeCoverage } from '@/features/records-management/lib/compute-scope-coverage'
import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/client'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'

interface MeetingProposalsPaneProps {
  meeting: MeetingRow
  proposals: CustomerProfileProposal[]
  isLoading: boolean
  onMutationSuccess: () => void
  className?: string
}

export function MeetingProposalsPane({ meeting, proposals, isLoading, onMutationSuccess, className }: MeetingProposalsPaneProps) {
  const ability = useAbility()

  const tradeSelections = meeting.flowStateJSON?.tradeSelections
  const coverageByProposal = useMemo(
    () => new Map(proposals.map(proposal => [proposal.id, computeScopeCoverage(tradeSelections ?? [], proposal.sowSummary)])),
    [proposals, tradeSelections],
  )

  // Proposals are listed through the customer's profile, so a meeting without a customer can have
  // proposals (the row's dots) that this pane can't list.
  const unlistedCount = meeting.customerId ? 0 : meeting.proposalStatuses.length

  return (
    <ExpandedRowPanel.Pane title="Proposals" isLoading={isLoading} className={className}>
      {unlistedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {`${unlistedCount} ${unlistedCount === 1 ? 'proposal' : 'proposals'} · link a customer to see ${unlistedCount === 1 ? 'it' : 'them'} here`}
        </p>
      )}
      {unlistedCount === 0 && proposals.length === 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">No proposals yet</p>
          {ability.can('create', 'Proposal') && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link href={ROOTS.dashboard.proposals.newForMeeting(meeting.id)}>
                <PlusIcon className="size-3" />
                Create Proposal
              </Link>
            </Button>
          )}
        </div>
      )}
      {proposals.length > 0 && (
        <ProposalActionsHost>
          <ul className="flex flex-col gap-2">
            {proposals.map((proposal) => {
              const coverage = coverageByProposal.get(proposal.id)
              return (
                <li key={proposal.id}>
                  <MeetingProposalRow
                    proposal={proposal}
                    onMutationSuccess={onMutationSuccess}
                    showSentDate
                    meta={coverage ? { scopeCoverage: coverage } : undefined}
                    footer={coverage ? <ProposalOverviewCard.ScopeCoverage className="pt-1" /> : undefined}
                  />
                </li>
              )
            })}
          </ul>
        </ProposalActionsHost>
      )}
    </ExpandedRowPanel.Pane>
  )
}
