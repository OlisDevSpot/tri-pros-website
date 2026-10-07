'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import { useState } from 'react'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { UserCommandItem } from '@/shared/entities/users/components/user-command-item'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface SetterPickerProps {
  /** The current setter; `null` = none; `undefined` = unknown, so nothing is checked. */
  value: string | null | undefined
  onPick: (userId: string | null) => void
  disabled?: boolean
}

const NO_SETTER_VALUE = 'No setter'

export function SetterPicker({ value, onPick, disabled = false }: SetterPickerProps) {
  const trpc = useTRPC()
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))

  const [highlighted, setHighlighted] = useState<string>()

  // cmdk would highlight "No setter" on open, and a stray Enter would clear the setter; start on the current choice instead.
  const currentSetter = value ? setters.data?.find(setter => setter.id === value) : undefined
  const currentRowValue = value === null
    ? NO_SETTER_VALUE
    : currentSetter && `${currentSetter.name ?? currentSetter.email ?? 'Unknown'} ${currentSetter.email ?? ''}`
  const ready = currentRowValue !== undefined || value === undefined

  return (
    <Command
      className="w-full bg-transparent"
      value={highlighted ?? currentRowValue}
      onValueChange={(next) => {
        if (ready) {
          setHighlighted(next)
        }
      }}
    >
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
                  <CommandItem value={NO_SETTER_VALUE} disabled={disabled} onSelect={() => onPick(null)} className="gap-3 px-3 py-2.5 data-[selected=true]:bg-muted/70">
                    <CheckIcon className={cn('size-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} />
                    <span className="text-sm text-muted-foreground">No setter</span>
                  </CommandItem>
                  {(setters.data ?? []).map(setter => (
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
