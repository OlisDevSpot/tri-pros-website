'use client'

import { useQuery } from '@tanstack/react-query'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { getInitials } from '@/shared/lib/get-initials'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface ReadOnlyParticipantSummaryProps {
  meetingId: string
  variant?: 'default' | 'compact'
}

/*
 * Non-interactive read-only fallback rendered in place of `ParticipantPicker`
 * for users who lack the `assign Meeting` ability. Mirrors the picker
 * trigger's visual structure (avatar group + summary text) so the surrounding
 * layout doesn't shift, but with no chevron / popover / hover affordance.
 *
 * Fetches participants via the same `getParticipants` query the picker uses
 * (option A — simple parallel fetch). If/when the picker is refactored to
 * accept participants as props, both call sites can lift the fetch out.
 */
export function ReadOnlyParticipantSummary({
  meetingId,
  variant = 'default',
}: ReadOnlyParticipantSummaryProps) {
  const trpc = useTRPC()

  const participantsQuery = useQuery(
    trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
  )

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

  const isCompact = variant === 'compact'

  return (
    <div
      aria-label={`Participants: ${summary}`}
      className={cn(
        // Mirror Button variant="outline" size="sm" structure (minus interactivity)
        // so the header layout doesn't shift between picker and read-only states.
        'inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border/70 text-sm font-medium text-foreground shadow-xs h-8 px-3',
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
