'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { Loader2, Plus } from 'lucide-react'

import { PARTICIPANT_ADD_LABELS } from '@/shared/entities/meetings/constants/participant-add-labels'
import { UserCommandItem } from '@/shared/entities/users/components/user-command-item'
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

export function AvailableParticipantRow({
  user,
  inferredRole,
  disabled,
  isPending,
  onAdd,
}: AvailableParticipantRowProps) {
  const name = user.name ?? user.email ?? 'Unknown'

  return (
    <UserCommandItem
      user={user}
      disabled={disabled || isPending}
      onSelect={() => {
        if (!disabled && !isPending) {
          onAdd()
        }
      }}
      ariaLabel={`${PARTICIPANT_ADD_LABELS[inferredRole]} — ${name}`}
      className={cn(disabled && 'opacity-50')}
      trailing={(
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 group-data-[selected=true]:text-foreground motion-safe:transition-opacity">
          {isPending
            ? <Loader2 className="size-3 animate-spin" />
            : (
                <>
                  <Plus className="size-3" />
                  {PARTICIPANT_ADD_LABELS[inferredRole]}
                </>
              )}
        </span>
      )}
    />
  )
}
