'use client'

import { CheckIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/shared/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

interface Props<TStatus extends string> {
  currentStatus: TStatus
  statuses: readonly TStatus[]
  colorMap: Partial<Record<TStatus, string>>
  onChange: (status: TStatus) => void
  formatLabel?: (status: TStatus) => string
}

export function StatusDropdownCell<TStatus extends string>({
  currentStatus,
  statuses,
  colorMap,
  onChange,
  formatLabel = status => status.replace(/_/g, ' '),
}: Props<TStatus>) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
        <button type="button" className="cursor-pointer">
          <Badge className={cn('capitalize text-xs', colorMap[currentStatus])}>
            {formatLabel(currentStatus)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1" onClick={e => e.stopPropagation()}>
        {statuses.map(status => (
          <button
            key={status}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize cursor-pointer',
              'hover:bg-accent hover:text-accent-foreground',
              status === currentStatus && 'font-medium',
            )}
            onClick={() => {
              onChange(status)
              setOpen(false)
            }}
          >
            <CheckIcon className={cn('h-3.5 w-3.5 shrink-0', status === currentStatus ? 'opacity-100' : 'opacity-0')} />
            <Badge className={cn('capitalize text-xs', colorMap[status])}>
              {formatLabel(status)}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
