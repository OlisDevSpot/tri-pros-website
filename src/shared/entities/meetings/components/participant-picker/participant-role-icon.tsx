'use client'

import { Crown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface ParticipantRoleIconProps {
  /** True when this participant is the meeting's primary owner. */
  isOwner: boolean
  className?: string
}

/**
 * Role indicator. For the owner, a warm amber crown glyph with no filled
 * background — the row itself carries the primary-tinted surface, so the icon
 * doesn't need to repeat that emphasis. For a co-owner (promote affordance),
 * a muted outline crown that warms up on hover.
 */
export function ParticipantRoleIcon({ isOwner, className }: ParticipantRoleIconProps) {
  if (isOwner) {
    return (
      <Crown
        aria-hidden="true"
        strokeWidth={2}
        className={cn('size-4.5 text-chart-3', className)}
      />
    )
  }

  return (
    <Crown
      aria-hidden="true"
      strokeWidth={1.5}
      className={cn(
        'size-4.5 text-muted-foreground/40',
        'group-hover:text-chart-3 group-focus-visible:text-chart-3',
        'motion-safe:transition-colors',
        className,
      )}
    />
  )
}
