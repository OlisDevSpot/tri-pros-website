'use client'

import { Crown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface ParticipantRoleIconProps {
  /** True when this participant is the meeting's primary owner. */
  isOwner: boolean
  className?: string
}

/**
 * Single-icon role indicator. Filled (gold-on-primary) when owner; outlined and
 * muted when co_owner / available-to-promote. Renders inert content only — the
 * caller wraps it in a button when interactive.
 */
export function ParticipantRoleIcon({ isOwner, className }: ParticipantRoleIconProps) {
  if (isOwner) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md bg-primary text-amber-300',
          className,
        )}
      >
        <Crown className="size-4" strokeWidth={2} />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/30 transition-colors',
        'group-hover:text-primary group-hover:bg-accent group-focus-visible:text-primary group-focus-visible:bg-accent',
        'motion-safe:transition-colors',
        className,
      )}
    >
      <Crown className="size-4" strokeWidth={1.5} />
    </span>
  )
}
