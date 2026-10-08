'use client'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface ProjectMeetingListProps {
  customerId: string
  meetings: CustomerProfileMeeting[]
  onMutationSuccess: () => void
  onNavigate?: () => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
  highlightMeetingId?: string
}

export function ProjectMeetingList({ customerId, meetings, onMutationSuccess, onNavigate, onAssignRep, highlightMeetingId }: ProjectMeetingListProps) {
  const ability = useAbility()
  const canCreateProposal = ability.can('create', 'Proposal')

  return (
    <div className="space-y-2.5">
      {meetings.map(meeting => (
        <Card key={meeting.id} className="group pt-0 pb-0 gap-0">
          {/* The tint goes on the content: the card keeps its `bg-card` class, so what sits in it still climbs a rung. */}
          <CardContent className={cn('p-0', meeting.id === highlightMeetingId && 'rounded-[inherit] bg-row-selected')}>
            <MeetingOverviewCard
              meeting={meeting}
              customerId={customerId}
              onAssignOwner={onAssignRep ? () => onAssignRep(meeting.id, meeting.ownerId ?? null) : undefined}
            >
              <MeetingOverviewCard.Header className="px-3 py-2">
                <MeetingOverviewCard.Fields fields={[
                  { field: 'scheduledDate' },
                  { field: 'type' },
                  { field: 'outcome' },
                  { field: 'proposalCount' },
                ]}
                />
                <MeetingOverviewCard.CreatedAt />
                <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
              </MeetingOverviewCard.Header>
              <div className="grid grid-cols-1 border-t divide-y md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:divide-y-0 md:divide-x">
                <div className="p-3">
                  <ParticipantsSlot meetingId={meeting.id} variant="full" entityListVariant="flush" />
                </div>
                <div className="p-3">
                  <MeetingOverviewCard.Proposals
                    showHeader
                    entityListVariant="flush"
                    emptyStateAction={canCreateProposal && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        asChild
                      >
                        <Link href={ROOTS.dashboard.proposals.newForMeeting(meeting.id)}>
                          <PlusIcon className="size-3" />
                          Create proposal
                        </Link>
                      </Button>
                    )}
                    renderProposal={p => (
                      <MeetingProposalRow
                        key={p.id}
                        proposal={p as CustomerProfileProposal}
                        onMutationSuccess={onMutationSuccess}
                        onNavigate={onNavigate}
                      />
                    )}
                  />
                </div>
              </div>
            </MeetingOverviewCard>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
