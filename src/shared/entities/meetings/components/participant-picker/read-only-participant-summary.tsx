'use client'

import type { InitialParticipantSummary } from './types'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { buttonVariants } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
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
    ...trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId }),
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

  // Build the avatar stack imperatively — the prior `[owner && {...}, coOwner && {...}].filter(u => u !== null)`
  // form leaked `undefined` entries when `.find()` returned undefined (not null),
  // crashing StackSlot on the next `.map(user => key={user.id})`.
  const stackUsers: Array<{ id: string, name: string, image: string | null }> = []
  if (owner) {
    stackUsers.push({ id: owner.userId, name: ownerName ?? 'Unknown', image: owner.userImage })
  }
  if (coOwner) {
    stackUsers.push({ id: coOwner.userId, name: coOwnerName ?? 'Unknown', image: coOwner.userImage })
  }

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
      {stackUsers.length > 0
        ? <UserOverviewCard.Stack users={stackUsers} size="xs" withTooltip={false} />
        : (
            <span
              aria-hidden="true"
              className="size-5 rounded-full border border-dashed border-muted-foreground/40"
            />
          )}
      {!isCompact && <span className="truncate text-xs font-medium">{summary}</span>}
    </div>
  )
}
