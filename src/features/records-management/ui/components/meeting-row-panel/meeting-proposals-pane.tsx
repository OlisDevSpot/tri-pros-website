'use client'

import type { CustomerProfileProposal } from '@/shared/entities/customers/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { PlusIcon } from 'lucide-react'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'

interface MeetingProposalsPaneProps {
  meeting: MeetingRow
  proposals: CustomerProfileProposal[]
  isLoading: boolean
  onMutationSuccess: () => void
  className?: string
}

export function MeetingProposalsPane({ meeting, proposals, isLoading, onMutationSuccess, className }: MeetingProposalsPaneProps) {
  const ability = useAbility()

  return (
    <ExpandedRowPanel.Pane title="Proposals" isLoading={isLoading} className={className}>
      {proposals.length === 0
        ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">No proposals yet</p>
              {ability.can('create', 'Proposal') && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                  <a href={`${ROOTS.dashboard.proposals.new()}?meetingId=${meeting.id}`}>
                    <PlusIcon className="size-3" />
                    Create Proposal
                  </a>
                </Button>
              )}
            </div>
          )
        : (
            <ul className="flex flex-col gap-2">
              {proposals.map(proposal => (
                <li key={proposal.id}>
                  <MeetingProposalRow proposal={proposal} onMutationSuccess={onMutationSuccess} showSentDate />
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
