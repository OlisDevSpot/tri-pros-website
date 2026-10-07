'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { useTRPC } from '@/trpc/helpers'

interface SetterSelectProps {
  /** `undefined` = not picked yet, which means the viewer. */
  value: string | undefined
  onChange: (userId: string) => void
  selfId: string | null
  selfName: string | null
}

export function SetterSelect({ value, onChange, selfId, selfName }: SetterSelectProps) {
  const [open, setOpen] = useState(false)
  const trpc = useTRPC()
  // Same key as the picker's own read, so the list loads once.
  const setters = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }))
  const current = value ?? selfId
  const label = setters.data?.find(setter => setter.id === current)?.name ?? (current === selfId ? selfName : null) ?? 'Loading…'

  return (
    // The add-meeting form sits in a dialog, whose scroll lock swallows wheel events over a non-modal popover.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // The phone tab bar covers the bottom edge.
        collisionPadding={{ bottom: 72, left: 16, right: 16 }}
        className="w-[min(420px,calc(100vw-2rem))] p-0"
      >
        <SetterPicker
          value={current ?? undefined}
          onPick={(userId) => {
            onChange(userId)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
