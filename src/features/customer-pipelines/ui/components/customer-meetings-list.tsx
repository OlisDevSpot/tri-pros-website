'use client'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { CreateMeetingForm } from '@/features/meetings/ui/components/create-meeting-form'
import { MeetingOverviewCard } from '@/shared/components/entities/meetings/overview-card'
import { EmptyState } from '@/shared/components/states/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'

interface Props {
  meetings: CustomerProfileMeeting[]
  customerId: string
  customerName: string
  highlightMeetingId?: string
  onMutationSuccess: () => void
}

export function CustomerMeetingsList({
  meetings,
  customerId,
  customerName,
  highlightMeetingId,
  onMutationSuccess: _onMutationSuccess,
}: Props) {
  const ability = useAbility()
  const [popoverOpen, setPopoverOpen] = useState(false)

  function handleCreateSuccess() {
    setPopoverOpen(false)
    _onMutationSuccess()
  }

  return (
    <div className="space-y-3">
      {/* Header with Add Meeting */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Meetings (
          {meetings.length}
          )
        </h4>
        {ability.can('create', 'Meeting') && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-3.5 w-3.5 mr-1" />
                Add Meeting
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <CreateMeetingForm
                customerId={customerId}
                customerName={customerName}
                onSuccess={handleCreateSuccess}
                onCancel={() => setPopoverOpen(false)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Meeting cards */}
      {meetings.length === 0
        ? (
            <EmptyState title="No meetings" description="No meetings scheduled for this customer" />
          )
        : (
            meetings.map(meeting => (
              <Card key={meeting.id} className={cn('group pt-0 pb-0 gap-0', meeting.id === highlightMeetingId && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
                <CardContent className="p-0">
                  <MeetingOverviewCard meeting={meeting} customerId={customerId}>
                    <MeetingOverviewCard.Header className="px-3 py-2">
                      <MeetingOverviewCard.Fields fields={[
                        { field: 'scheduledDate', format: 'full' },
                        { field: 'type' },
                        { field: 'outcome' },
                        { field: 'proposalCount' },
                      ]}
                      />
                      <MeetingOverviewCard.CreatedAt />
                      <MeetingOverviewCard.Actions mode="compact" className="ml-auto opacity-60 hover:opacity-100 transition-opacity" />
                    </MeetingOverviewCard.Header>
                    <MeetingOverviewCard.Proposals
                      showHeader={false}
                      className="border-t px-3 pt-2 pb-2 space-y-0.5"
                      renderProposal={p => (
                        <MeetingProposalRow
                          key={p.id}
                          proposal={p as CustomerProfileProposal}
                          onMutationSuccess={_onMutationSuccess}
                        />
                      )}
                    />
                  </MeetingOverviewCard>
                </CardContent>
              </Card>
            ))
          )}
    </div>
  )
}
