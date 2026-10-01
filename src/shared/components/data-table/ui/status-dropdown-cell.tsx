'use client'

import { CheckIcon, ChevronDownIcon } from 'lucide-react'
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
  /** Extra classes for the trigger badge — e.g. compact sizing on dense cards. */
  triggerClassName?: string
  /** Render a chevron on the trigger to signal the badge is editable. */
  showCaret?: boolean
  /** Accessible name for the trigger; defaults to the visible label alone. */
  triggerAriaLabel?: string
  /**
   * Option row rendering. 'pill' (default) shows a tinted badge per option;
   * 'dot' shows a solid status dot + a full-contrast label — far more legible
   * in a long list where the tinted pills wash out.
   */
  optionStyle?: 'pill' | 'dot'
  /** Solid dot colors, required for optionStyle='dot'. */
  dotColorMap?: Partial<Record<TStatus, string>>
}

export function StatusDropdownCell<TStatus extends string>({
  currentStatus,
  statuses,
  colorMap,
  onChange,
  formatLabel = status => status.replace(/_/g, ' '),
  isStatusDisabled,
  triggerClassName,
  showCaret = false,
  triggerAriaLabel,
  optionStyle = 'pill',
  dotColorMap,
}: Props<TStatus>) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
        <button
          type="button"
          aria-label={triggerAriaLabel}
          className="group/status-trigger cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Badge className={cn('capitalize text-xs', colorMap[currentStatus], triggerClassName)}>
            {formatLabel(currentStatus)}
            {showCaret && (
              <ChevronDownIcon className="opacity-50 transition-opacity group-hover/status-trigger:opacity-100" />
            )}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-auto min-w-40 overflow-y-auto p-1" onClick={e => e.stopPropagation()}>
        {statuses.map((status) => {
          const isDisabled = status !== currentStatus && isStatusDisabled?.(status)
          const isCurrent = status === currentStatus

          return (
            <button
              key={status}
              type="button"
              disabled={!!isDisabled}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize transition-colors duration-150',
                isDisabled
                  ? 'cursor-not-allowed opacity-40'
                  : optionStyle === 'dot'
                    ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                    : 'cursor-pointer hover:bg-muted/50 hover:text-accent-foreground',
                isCurrent && (optionStyle === 'dot' ? 'bg-accent/60 font-medium' : 'font-medium'),
              )}
              onClick={() => {
                if (isDisabled) {
                  return
                }
                onChange(status)
                setOpen(false)
              }}
            >
              <CheckIcon className={cn('h-3.5 w-3.5 shrink-0', isCurrent ? 'opacity-100' : 'opacity-0')} />
              {optionStyle === 'dot'
                ? (
                    <>
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColorMap?.[status])} />
                      {formatLabel(status)}
                    </>
                  )
                : (
                    <Badge className={cn('capitalize text-xs', colorMap[status])}>
                      {formatLabel(status)}
                    </Badge>
                  )}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
