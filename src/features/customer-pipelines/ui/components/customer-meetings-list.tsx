'use client'

import type { CustomerProfileMeeting } from '@/features/customer-pipelines/types'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { MeetingEntityCard } from '@/features/customer-pipelines/ui/components/meeting-entity-card'
import { CreateMeetingForm } from '@/features/meetings/ui/components/create-meeting-form'
import { EmptyState } from '@/shared/components/states/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useAbility } from '@/shared/permissions/hooks'

interface Props {
  meetings: CustomerProfileMeeting[]
  customerId: string
  customerName: string
  onMutationSuccess: () => void
}

export function CustomerMeetingsList({
  meetings,
  customerId,
  customerName,
  onMutationSuccess,
}: Props) {
  const ability = useAbility()
  const { close: closeModal } = useModalStore()
  const [popoverOpen, setPopoverOpen] = useState(false)

  function handleCreateSuccess() {
    setPopoverOpen(false)
    onMutationSuccess()
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
              <MeetingEntityCard
                key={meeting.id}
                meeting={meeting}
                onMutationSuccess={onMutationSuccess}
                onNavigate={closeModal}
              />
            ))
          )}
    </div>
  )
}
