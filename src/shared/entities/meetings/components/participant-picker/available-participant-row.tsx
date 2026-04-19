'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { Loader2, Plus } from 'lucide-react'

import { CommandItem } from '@/shared/components/ui/command'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface AvailableParticipantRowProps {
  user: UserOverviewCardUser
  /** Role this user will be added as if clicked — used in the affordance label. */
  inferredRole: 'owner' | 'co_owner'
  /** True when both slots are full; row is dimmed and click is no-op. */
  disabled: boolean
  isPending: boolean
  onAdd: () => void
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
      className={cn(
        'group flex items-center gap-2 rounded-md p-2',
        disabled && 'opacity-50',
      )}
      aria-label={`Add ${name} as ${inferredRole === 'owner' ? 'owner' : 'co-owner'}`}
    >
      <UserOverviewCard user={user} className="contents">
        <UserOverviewCard.Avatar size="sm" className="size-6" />
        <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
          <UserOverviewCard.Name className="text-sm font-medium text-foreground" />
          <UserOverviewCard.Email className="text-xs text-muted-foreground" />
        </div>
      </UserOverviewCard>

      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground opacity-60 group-hover:opacity-100 group-data-[selected=true]:opacity-100 motion-safe:transition-opacity">
        {isPending
          ? <Loader2 className="size-3 animate-spin" />
          : (
              <>
                <Plus className="size-3" />
                {inferredRole === 'owner' ? 'add as owner' : 'add as co-owner'}
              </>
            )}
      </span>
    </CommandItem>
  )
}
