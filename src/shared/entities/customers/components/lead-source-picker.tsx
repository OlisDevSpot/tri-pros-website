'use client'

import type { ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import { useState } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface LeadSourcePickerProps {
  /** Currently-assigned lead source id; `null` for legacy NULL rows. */
  currentLeadSourceId: string | null
  /** Called with the picked source id. Caller fires the mutation + closes are auto. */
  onPick: (leadSourceId: string) => void
  /** Trigger element. Wrapped in a button for keyboard + a11y. */
  children: ReactNode
  /** Visually hint disabled (still rendered, no popover). */
  disabled?: boolean
}

/**
 * Glassy popover that lets a super-admin reassign a customer's lead source.
 * Reuses the shared `Popover` (already glass via `--popover-glass*` tokens)
 * and `Command` (cmdk-powered search + keyboard nav).
 *
 * Hides inactive sources — reassigning to a deactivated source is almost
 * always a mistake; super-admins manage activation in the Lead Sources view.
 */
export function LeadSourcePicker({
  currentLeadSourceId,
  onPick,
  children,
  disabled,
}: LeadSourcePickerProps) {
  const [open, setOpen] = useState(false)
  const trpc = useTRPC()

  // Fetch only when the popover is opened — avoids N requests when many
  // rows render the trigger.
  const { data, isLoading } = useQuery({
    ...trpc.leadSourcesRouter.list.queryOptions({ includeInactive: false }),
    enabled: open && !disabled,
  })

  if (disabled) {
    return <>{children}</>
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change lead source"
          onClick={e => e.stopPropagation()}
          className={cn(
            'group/lead-source -mx-1.5 -my-1 inline-flex w-[calc(100%+0.75rem)] min-w-0 items-center rounded-md px-1.5 py-1 text-left',
            'transition-colors hover:bg-foreground/5',
            'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
            'data-[state=open]:bg-foreground/8',
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        onClick={e => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search sources…" autoFocus />
          <CommandList>
            {isLoading
              ? <CommandEmpty>Loading…</CommandEmpty>
              : <CommandEmpty>No matching source.</CommandEmpty>}
            {data && data.length > 0 && (
              <CommandGroup>
                {data.map((src) => {
                  const selected = src.id === currentLeadSourceId
                  return (
                    <CommandItem
                      key={src.id}
                      value={`${src.name} ${src.slug}`}
                      onSelect={() => {
                        if (!selected) {
                          onPick(src.id)
                        }
                        setOpen(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-sm font-medium text-foreground">
                          {src.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground tabular-nums" translate="no">
                          /
                          {src.slug}
                        </span>
                      </span>
                      <CheckIcon
                        aria-hidden
                        className={cn(
                          'size-4 shrink-0 text-foreground transition-opacity',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
