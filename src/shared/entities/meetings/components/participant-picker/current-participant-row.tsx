'use client'

import { Loader2, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

import { ParticipantRoleIcon } from './participant-role-icon'

interface CurrentParticipantRowProps {
  name: string
  email: string | null
  image: string | null
  role: 'owner' | 'co_owner'
  /** Disable the remove button (last owner protection). */
  removeDisabled: boolean
  /** Disabled-state explanation, shown in tooltip when removeDisabled is true. */
  removeDisabledReason?: string
  /** True while a mutation targeting this row is in flight. */
  isPending: boolean
  /** Click handler for the crown icon (only meaningful for co_owner — promote). */
  onPromote: () => void
  /** Click handler for the remove (✕) button. */
  onRemove: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function CurrentParticipantRow({
  name,
  email,
  image,
  role,
  removeDisabled,
  removeDisabledReason,
  isPending,
  onPromote,
  onRemove,
}: CurrentParticipantRowProps) {
  const isOwner = role === 'owner'
  const roleLabel = isOwner ? 'Owner' : 'Co-owner'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card p-2',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">
          <span
            className={cn(
              'mr-1.5 text-[10px] font-semibold uppercase tracking-wide',
              isOwner ? 'text-primary' : 'text-teal-700 dark:text-teal-400',
            )}
          >
            {roleLabel}
          </span>
          {email}
        </div>
      </div>

      {/* Crown — interactive only when co_owner (promote action) */}
      {isOwner
        ? (
            <span title="Already owner">
              <ParticipantRoleIcon isOwner />
            </span>
          )
        : (
            <button
              type="button"
              onClick={onPromote}
              disabled={isPending}
              aria-label={`Promote ${name} to owner`}
              className="group inline-flex size-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ParticipantRoleIcon isOwner={false} />
            </button>
          )}

      {/* Remove ✕ */}
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
                    className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
                  >
                    <X className="size-4" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{removeDisabledReason ?? 'Meeting requires at least one owner'}</TooltipContent>
            </Tooltip>
          )
        : (
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              aria-label={`Remove ${name} from this meeting`}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            </button>
          )}
    </div>
  )
}
