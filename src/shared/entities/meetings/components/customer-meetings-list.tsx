'use client'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { EmptyState } from '@/shared/components/states/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/client'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface Props {
  meetings: CustomerProfileMeeting[]
  highlightMeetingId?: string
}

export function CustomerMeetingsList({
  meetings,
  highlightMeetingId,
}: Props) {
  const ability = useAbility()

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        {`Meetings (${meetings.length})`}
      </h4>

      {/* Meeting cards */}
      {meetings.length === 0
        ? (
            <EmptyState title="No meetings" description="No meetings scheduled for this customer" />
          )
        : (
            meetings.map(meeting => (
              <Card key={meeting.id} className={cn('group pt-0 pb-0 gap-0', meeting.id === highlightMeetingId && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
                <CardContent className="p-0">
                  <MeetingOverviewCard meeting={meeting}>
                    <MeetingOverviewCard.Header className="px-3 py-2">
                      <MeetingOverviewCard.Fields fields={[
                        { field: 'scheduledDate' },
                        { field: 'type' },
                        { field: 'outcome' },
                        { field: 'proposalCount' },
                      ]}
                      />
                      <MeetingOverviewCard.CreatedAt />
                      <MeetingOverviewCard.Actions mode="compact" className="ml-auto opacity-60 hover:opacity-100 transition-opacity" />
                    </MeetingOverviewCard.Header>
                    {/* Peer detail panels: Participants | Proposals. One outer
                        surface + internal divider (md+ = vertical, mobile =
                        horizontal stack). Proposals is wider (3fr vs 2fr) —
                        it's the primary content; participants is contextual. */}
                    <div className="grid grid-cols-1 border-t divide-y md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:divide-y-0 md:divide-x">
                      <div className="p-3">
                        <ParticipantsSlot meetingId={meeting.id} variant="full" entityListVariant="flush" />
                      </div>
                      <div className="p-3">
                        <MeetingOverviewCard.Proposals
                          showHeader
                          entityListVariant="flush"
                          emptyStateAction={ability.can('create', 'Proposal') && (
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
                            />
                          )}
                        />
                      </div>
                    </div>
                  </MeetingOverviewCard>
                </CardContent>
              </Card>
            ))
          )}
    </div>
  )
}
