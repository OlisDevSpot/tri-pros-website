'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { Loader2, X } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

import { ParticipantRoleIcon } from './participant-role-icon'

interface CurrentParticipantRowProps {
  user: UserOverviewCardUser
  role: 'owner' | 'co_owner'
  /** Disable the remove button (last owner protection). */
  removeDisabled: boolean
  /** Disabled-state explanation, shown in tooltip when removeDisabled is true. */
  removeDisabledReason?: string
  /** Tooltip shown on the remove button when it is enabled (e.g. to clarify side-effects). */
  removeTooltip?: string
  /**
   * Id of a live region / note that explains the disabled-state to screen
   * readers. Wired via aria-describedby on the disabled remove button.
   */
  removeDisabledHintId?: string
  /** True while a mutation targeting this row is in flight. */
  isPending: boolean
  /** Click handler for the crown icon (only meaningful for co_owner — promote). */
  onPromote: () => void
  /** Click handler for the remove (✕) button. */
  onRemove: () => void
}

export function CurrentParticipantRow({
  user,
  role,
  removeDisabled,
  removeDisabledReason,
  removeTooltip,
  removeDisabledHintId,
  isPending,
  onPromote,
  onRemove,
}: CurrentParticipantRowProps) {
  const isOwner = role === 'owner'
  const name = user.name ?? 'Unknown'
  const roleLabel = isOwner ? 'Owner' : 'Co-owner'

  return (
    <UserOverviewCard
      user={user}
      meta={{ role }}
      className={cn(
        'group/row flex items-center gap-3 rounded-lg border px-3 py-2.5',
        // The owner row takes the selection tint so the eye lands there first.
        isOwner ? 'border-transparent bg-row-selected' : 'border-border',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <UserOverviewCard.Avatar size="sm" className="size-8" />

      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground" />
        <div className="truncate text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground">{roleLabel}</span>
          {user.email != null && user.email !== '' && (
            <>
              <span aria-hidden="true" className="mx-1.5 text-muted-foreground">·</span>
              <span>{user.email}</span>
            </>
          )}
        </div>
      </div>

      {isOwner
        ? (
            <span className="inline-flex size-11 items-center justify-center" title="Owner">
              <ParticipantRoleIcon isOwner />
            </span>
          )
        : (
            <button
              type="button"
              onClick={onPromote}
              disabled={isPending}
              aria-label={`Promote ${name} to owner`}
              className="group inline-flex size-11 items-center justify-center rounded-md hover:bg-hover pressed:bg-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
            >
              <ParticipantRoleIcon isOwner={false} />
            </button>
          )}

      {removeDisabled
        ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-label={`Cannot remove ${name} — ${removeDisabledReason ?? 'meeting needs at least one owner'}`}
                    aria-describedby={removeDisabledHintId}
                    className="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{removeDisabledReason ?? 'Meeting requires at least one owner'}</TooltipContent>
            </Tooltip>
          )
        : removeTooltip
          ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={isPending}
                    aria-label={`Remove ${name} from this meeting`}
                    className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-destructive-text pressed:bg-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{removeTooltip}</TooltipContent>
              </Tooltip>
            )
          : (
              <button
                type="button"
                onClick={onRemove}
                disabled={isPending}
                aria-label={`Remove ${name} from this meeting`}
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-destructive-text pressed:bg-press focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              </button>
            )}
    </UserOverviewCard>
  )
}
