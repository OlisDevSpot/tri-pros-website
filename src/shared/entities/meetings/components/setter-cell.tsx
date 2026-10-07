'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'

interface SetterCellProps {
  /** `null` = a row that predates setters. */
  setter: { id: string, name: string | null, image: string | null } | null
  onPick: (userId: string) => void
}

/** The Setter column's inline picker, shaped like the Rep column's: the setter as a compact trigger, the team in a popover. */
export function SetterCell({ setter, onPick }: SetterCellProps) {
  const [open, setOpen] = useState(false)
  const label = setter ? (setter.name ?? 'Unknown') : 'Not recorded'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Setter: ${label}`}
          className="h-8 max-w-full gap-2 px-2"
        >
          {setter
            ? (
                <UserOverviewCard user={setter} className="contents">
                  <UserOverviewCard.Avatar size="xs" />
                  <UserOverviewCard.Name className="min-w-0 text-xs font-medium" />
                </UserOverviewCard>
              )
            : (
                <>
                  <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
                  <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{label}</span>
                </>
              )}
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        collisionPadding={16}
        sideOffset={8}
      >
        <SetterPicker
          value={setter?.id}
          onPick={(userId) => {
            setOpen(false)
            if (userId !== setter?.id) {
              onPick(userId)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
