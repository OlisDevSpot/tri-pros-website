'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface ParticipantSummary {
  userId: string
  name: string
  image: string | null
}

interface ParticipantPickerTriggerProps
  extends Omit<React.ComponentProps<typeof Button>, 'children' | 'variant' | 'size'> {
  owner: ParticipantSummary | null
  coOwner: ParticipantSummary | null
  variant?: 'default' | 'compact'
  isLoading?: boolean
}

export function ParticipantPickerTrigger({
  ref,
  owner,
  coOwner,
  variant = 'default',
  isLoading = false,
  className,
  ...rest
}: ParticipantPickerTriggerProps) {
  const summary = !owner && !coOwner
    ? 'Unassigned'
    : coOwner
      ? `${owner?.name ?? '—'} + ${coOwner.name}`
      : (owner?.name ?? '—')

  const isCompact = variant === 'compact'

  const stackUsers = [
    owner && { id: owner.userId, name: owner.name, image: owner.image },
    coOwner && { id: coOwner.userId, name: coOwner.name, image: coOwner.image },
  ].filter((u): u is { id: string, name: string, image: string | null } => u !== null)

  return (
    <Button
      {...rest}
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      disabled={isLoading}
      aria-label={isCompact ? `Participants: ${summary}` : rest['aria-label']}
      className={cn('gap-2', isCompact && 'h-8 px-2', className)}
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
      <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </Button>
  )
}
