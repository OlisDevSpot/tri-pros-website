'use client'

import type { InitialParticipantSummary } from './types'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useTRPC } from '@/trpc/helpers'

import { buildPlaceholderParticipants } from './build-placeholder-participants'
import { ParticipantPickerContent } from './participant-picker-content'
import { ParticipantPickerTrigger } from './participant-picker-trigger'

interface ParticipantPickerProps {
  meetingId: string
  variant?: 'default' | 'compact'
  /** The owner the parent already loaded (e.g. a table row). Shown while closed; no request until the picker opens. */
  initialOwner?: InitialParticipantSummary | null
  /** Optional co-owner snapshot (see `initialOwner`). */
  initialCoOwner?: InitialParticipantSummary | null
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
export function ParticipantPicker({
  meetingId,
  onManageClick,
  variant = 'default',
  initialOwner,
  initialCoOwner,
}: ParticipantPickerProps) {
  const trpc = useTRPC()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const snapshot = useMemo(
    () => buildPlaceholderParticipants(initialOwner, initialCoOwner),
    [initialOwner, initialCoOwner],
  )

  // A row that passes its owner needs no request until the picker opens. While closed it shows that
  // snapshot, not the cache: invalidation skips a disabled query, so the cache would keep a stale owner
  // after a reassign, while the refetched row carries the new one.
  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId }),
    enabled: popoverOpen || !snapshot,
  })

  const fetched = popoverOpen || !snapshot ? participantsQuery.data : undefined
  const participants = fetched ?? snapshot ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')
  const isLoading = !snapshot && participantsQuery.isLoading

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <ParticipantPickerTrigger
          coOwner={coOwner ? { image: coOwner.userImage, name: coOwner.userName ?? 'Unknown', userId: coOwner.userId } : null}
          isLoading={isLoading}
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
