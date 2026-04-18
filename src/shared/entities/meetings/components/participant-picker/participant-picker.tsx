'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useTRPC } from '@/trpc/helpers'

import { ParticipantPickerContent } from './participant-picker-content'
import { ParticipantPickerTrigger } from './participant-picker-trigger'

interface ParticipantPickerProps {
  meetingId: string
  variant?: 'default' | 'compact'
  /**
   * Called when the user clicks the footer "Manage participants" link.
   * Parent should open its ManageParticipantsModal. The picker auto-closes
   * its popover before invoking this.
   */
  onManageClick: () => void
}

/*
 * Inline owner/co-owner picker. Opens a popover with the current participants,
 * a search box, and a "Manage participants" link that delegates to the parent.
 */
export function ParticipantPicker({ meetingId, onManageClick, variant = 'default' }: ParticipantPickerProps) {
  const trpc = useTRPC()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const participantsQuery = useQuery(
    trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
  )

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <ParticipantPickerTrigger
          coOwner={coOwner ? { image: coOwner.userImage, name: coOwner.userName ?? 'Unknown', userId: coOwner.userId } : null}
          isLoading={participantsQuery.isLoading}
          owner={owner ? { image: owner.userImage, name: owner.userName ?? 'Unknown', userId: owner.userId } : null}
          variant={variant}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        collisionPadding={16}
        sideOffset={8}
      >
        <ParticipantPickerContent
          meetingId={meetingId}
          onOpenManageModal={() => {
            setPopoverOpen(false)
            onManageClick()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
