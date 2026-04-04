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
  /** Check if a status should be disabled. Current status is never disabled. */
  isStatusDisabled?: (status: TStatus) => boolean
}

export function StatusDropdownCell<TStatus extends string>({
  currentStatus,
  statuses,
  colorMap,
  onChange,
  formatLabel = status => status.replace(/_/g, ' '),
  isStatusDisabled,
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
      <PopoverContent align="start" className="w-auto min-w-40 p-1" onClick={e => e.stopPropagation()}>
        {statuses.map((status) => {
          const isDisabled = status !== currentStatus && isStatusDisabled?.(status)

          return (
            <button
              key={status}
              type="button"
              disabled={!!isDisabled}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize transition-colors duration-150',
                isDisabled
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:bg-muted/50 hover:text-accent-foreground',
                status === currentStatus && 'font-medium',
              )}
              onClick={() => {
                if (isDisabled) {
                  return
                }
                onChange(status)
                setOpen(false)
              }}
            >
              <CheckIcon className={cn('h-3.5 w-3.5 shrink-0', status === currentStatus ? 'opacity-100' : 'opacity-0')} />
              <Badge className={cn('capitalize text-xs', colorMap[status])}>
                {formatLabel(status)}
              </Badge>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
