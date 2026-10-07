'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/shared/components/ui/command'
import { UserCommandItem } from '@/shared/entities/users/components/user-command-item'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface SetterPickerProps {
  /** The current setter; `undefined` = none or unknown, so nothing is checked. */
  value?: string
  onPick: (userId: string) => void
  disabled?: boolean
}

export function SetterPicker({ value, onPick, disabled = false }: SetterPickerProps) {
  const trpc = useTRPC()
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))

  // The current setter leads the list: cmdk highlights the first row and scrolls the highlighted row into
  // view, so a current setter further down would open the list scrolled to it, and a stray Enter must not
  // change anything.
  const team = setters.data ?? []
  const ordered = value ? [...team.filter(setter => setter.id === value), ...team.filter(setter => setter.id !== value)] : team

  return (
    <Command className="w-full bg-transparent">
      <CommandInput
        placeholder="Search team by name or email…"
        autoComplete="off"
        spellCheck={false}
        // Radix closes the sub-menu on ArrowLeft anywhere inside it, including while moving the caret.
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.stopPropagation()
          }
        }}
      />
      <CommandList className="max-h-72">
        {setters.isError
          ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Couldn’t load the team.</p>
          : (
              <>
                <CommandEmpty>{setters.isLoading ? 'Loading team…' : 'No team members match.'}</CommandEmpty>
                <CommandGroup>
                  {ordered.map(setter => (
                    <UserCommandItem
                      key={setter.id}
                      user={setter}
                      disabled={disabled}
                      onSelect={() => onPick(setter.id)}
                      leading={<CheckIcon className={cn('size-3.5 shrink-0', value === setter.id ? 'opacity-100' : 'opacity-0')} />}
                    />
                  ))}
                </CommandGroup>
              </>
            )}
      </CommandList>
    </Command>
  )
}
