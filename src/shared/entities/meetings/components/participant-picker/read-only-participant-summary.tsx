'use client'

import type { InitialParticipantSummary } from './types'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { buttonVariants } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { getInitials } from '@/shared/lib/get-initials'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

import { buildPlaceholderParticipants } from './build-placeholder-participants'

interface ReadOnlyParticipantSummaryProps {
  meetingId: string
  variant?: 'default' | 'compact'
  /**
   * Optional owner / co-owner snapshot supplied by the parent (e.g. table
   * rows). When provided, used as `initialData` so this component renders
   * instantly without per-row `getParticipants` fetches. Helpers aren't
   * displayed here, so `initialData` (no background refetch) is safe.
   */
  initialOwner?: InitialParticipantSummary | null
  initialCoOwner?: InitialParticipantSummary | null
}

/*
 * Non-interactive read-only fallback rendered in place of `ParticipantPicker`
 * for users who lack the `assign Meeting` ability. Mirrors the picker
 * trigger's visual structure (avatar group + summary text) so the surrounding
 * layout doesn't shift, but with no chevron / popover / hover affordance.
 *
 * Accepts optional `initialOwner` / `initialCoOwner` to seed the React Query
 * cache, eliminating per-row fetches in tables.
 */
export function ReadOnlyParticipantSummary({
  meetingId,
  variant = 'default',
  initialOwner,
  initialCoOwner,
}: ReadOnlyParticipantSummaryProps) {
  const trpc = useTRPC()

  const initialData = useMemo(
    () => buildPlaceholderParticipants(initialOwner, initialCoOwner),
    [initialOwner, initialCoOwner],
  )

  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
    initialData: initialData ?? undefined,
  })

  const isCompact = variant === 'compact'

  if (participantsQuery.isLoading) {
    return (
      <div
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'cursor-default hover:bg-transparent hover:text-foreground',
          isCompact && 'px-2',
        )}
      >
        <span className="flex items-center -space-x-1.5">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
        </span>
        {!isCompact && <Skeleton className="h-3 w-24" />}
      </div>
    )
  }

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')

  const ownerName = owner?.userName ?? null
  const coOwnerName = coOwner?.userName ?? null

  const summary = !owner && !coOwner
    ? 'Unassigned'
    : coOwner
      ? `${ownerName ?? '—'} + ${coOwnerName ?? 'Unknown'}`
      : (ownerName ?? '—')

  return (
    <div
      aria-label={`Participants: ${summary}`}
      className={cn(
        // Mirror Button variant="outline" size="sm" so the header layout
        // doesn't shift between picker and read-only states. Strip
        // interactive affordances since this is non-interactive.
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'cursor-default hover:bg-transparent hover:text-foreground',
        isCompact && 'px-2',
      )}
    >
      <span className="flex items-center -space-x-1.5">
        {owner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={owner.userImage ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(ownerName ?? 'Unknown')}</AvatarFallback>
          </Avatar>
        )}
        {coOwner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={coOwner.userImage ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(coOwnerName ?? 'Unknown')}</AvatarFallback>
          </Avatar>
        )}
        {!owner && !coOwner && (
          <span
            aria-hidden="true"
            className="size-5 rounded-full border border-dashed border-muted-foreground/40"
          />
        )}
      </span>
      {!isCompact && <span className="truncate text-xs font-medium">{summary}</span>}
    </div>
  )
}
