'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { CreateProposalPopover } from '@/features/customer-pipelines/ui/components/create-proposal-popover'
import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { EmptyState } from '@/shared/components/states/empty-state'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
}

export function CustomerProposalsList({ data, onMutationSuccess }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Proposals (
          {data.allProposals.length}
          )
        </h4>
        <CreateProposalPopover meetings={data.meetings} />
      </div>

      {data.allProposals.length === 0
        ? (
            <EmptyState title="No proposals" description="No proposals created for this customer" />
          )
        : (
            <div className="space-y-1">
              {data.allProposals.map(proposal => (
                <MeetingProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  onMutationSuccess={onMutationSuccess}
                />
              ))}
            </div>
          )}
    </div>
  )
}
