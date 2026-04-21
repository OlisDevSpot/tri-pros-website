'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { Loader2, Plus } from 'lucide-react'

import { CommandItem } from '@/shared/components/ui/command'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface AvailableParticipantRowProps {
  user: UserOverviewCardUser
  /** Role this user will be added as if clicked — used in the affordance label. */
  inferredRole: 'owner' | 'co_owner' | 'helper'
  /** True when both slots are full; row is dimmed and click is no-op. */
  disabled: boolean
  isPending: boolean
  onAdd: () => void
}

const ADD_LABEL: Record<'owner' | 'co_owner' | 'helper', string> = {
  owner: 'Add as owner',
  co_owner: 'Add as co-owner',
  helper: 'Add as helper',
}

export function AvailableParticipantRow({
  user,
  inferredRole,
  disabled,
  isPending,
  onAdd,
}: AvailableParticipantRowProps) {
  const name = user.name ?? user.email ?? 'Unknown'

  return (
    <CommandItem
      // cmdk filter uses the value field; combine searchable parts so name + email both match
      value={`${name} ${user.email ?? ''}`}
      disabled={disabled || isPending}
      onSelect={() => {
        if (!disabled && !isPending) {
          onAdd()
        }
      }}
      // Override shadcn's data-[selected=true]:bg-accent default. In our dark
      // theme, --accent equals --primary, which produces the overpowering blue
      // row-flood we're moving away from. Use a neutral muted tint instead so
      // hover/focus stays subtle and the owner row (which IS primary-tinted)
      // remains the single loudest element.
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2.5',
        'data-[selected=true]:bg-muted/70 hover:bg-muted/70',
        'data-[selected=true]:text-foreground',
        disabled && 'opacity-50',
      )}
      aria-label={`${ADD_LABEL[inferredRole]} — ${name}`}
    >
      <UserOverviewCard user={user} className="contents">
        <UserOverviewCard.Avatar size="sm" className="size-8" />
        <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
          <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground group-data-[selected=true]:font-semibold" />
          <UserOverviewCard.Email className="truncate text-xs text-muted-foreground" />
        </div>
      </UserOverviewCard>

      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 group-data-[selected=true]:text-foreground motion-safe:transition-opacity">
        {isPending
          ? <Loader2 className="size-3 animate-spin" />
          : (
              <>
                <Plus className="size-3" />
                {ADD_LABEL[inferredRole]}
              </>
            )}
      </span>
    </CommandItem>
  )
}
