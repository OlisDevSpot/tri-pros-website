'use client'

import type { ReactNode } from 'react'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { CommandItem } from '@/shared/components/ui/command'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface UserCommandItemProps {
  user: UserOverviewCardUser
  onSelect: () => void
  disabled?: boolean
  /** Before the avatar, e.g. a checkmark. */
  leading?: ReactNode
  /** After the name, e.g. an "Add as owner" chip. */
  trailing?: ReactNode
  ariaLabel?: string
  className?: string
}

export function UserCommandItem({ user, onSelect, disabled = false, leading, trailing, ariaLabel, className }: UserCommandItemProps) {
  const name = user.name ?? user.email ?? 'Unknown'

  return (
    <CommandItem
      // cmdk filters on `value`, so name and email both match.
      value={`${name} ${user.email ?? ''}`}
      disabled={disabled}
      onSelect={onSelect}
      aria-label={ariaLabel}
      // cmdk's `selected` is the keyboard hover, so it takes the hover tint; shadcn's `accent` would flood the row.
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2.5',
        'data-[selected=true]:bg-row-hover hover:bg-row-hover',
        'data-[selected=true]:text-foreground',
        className,
      )}
    >
      {leading}
      <UserOverviewCard user={user} className="contents">
        <UserOverviewCard.Avatar size="sm" className="size-8" />
        <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
          <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground group-data-[selected=true]:font-semibold" />
          <UserOverviewCard.Email className="truncate text-xs text-muted-foreground" />
        </div>
      </UserOverviewCard>
      {trailing}
    </CommandItem>
  )
}
