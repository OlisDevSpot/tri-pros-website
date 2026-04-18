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
  /**
   * Optional owner snapshot supplied by the parent (e.g. table row data).
   * When provided, used as `placeholderData` so the picker shows the current
   * owner instantly without waiting for `getParticipants` — eliminating the
   * per-row N+1 fetch on table mount. The real query still runs in the
   * background to populate helper count and pick up server-side updates.
   */
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

  const placeholderData = useMemo(
    () => buildPlaceholderParticipants(initialOwner, initialCoOwner),
    [initialOwner, initialCoOwner],
  )

  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
    // `placeholderData` (vs `initialData`) keeps the query in `pending` so
    // the helper count still gets refreshed in the background. Without an
    // initial snapshot, falls back to the existing loading behavior.
    placeholderData: placeholderData ?? undefined,
  })

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')

  // Treat the picker as "loaded" when we have a placeholder so the trigger
  // doesn't render a disabled/loading state on table mount.
  const isLoading = participantsQuery.isLoading && !placeholderData

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
