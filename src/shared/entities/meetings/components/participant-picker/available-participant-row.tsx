'use client'

import { Loader2, Plus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { CommandItem } from '@/shared/components/ui/command'
import { cn } from '@/shared/lib/utils'

interface AvailableParticipantRowProps {
  name: string
  email: string | null
  image: string | null
  /** Role this user will be added as if clicked — used in the affordance label. */
  inferredRole: 'owner' | 'co_owner'
  /** True when both slots are full; row is dimmed and click is no-op. */
  disabled: boolean
  isPending: boolean
  onAdd: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AvailableParticipantRow({
  name,
  email,
  image,
  inferredRole,
  disabled,
  isPending,
  onAdd,
}: AvailableParticipantRowProps) {
  return (
    <CommandItem
      // cmdk filter uses the value field; combine searchable parts so name + email both match
      value={`${name} ${email ?? ''}`}
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
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="text-[10px] font-semibold">{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>

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
