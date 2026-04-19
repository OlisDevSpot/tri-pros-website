'use client'

import { ChevronDown } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
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
      <span className="flex items-center -space-x-1.5">
        {owner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={owner.image ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(owner.name)}</AvatarFallback>
          </Avatar>
        )}
        {coOwner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={coOwner.image ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(coOwner.name)}</AvatarFallback>
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
      <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </Button>
  )
}
