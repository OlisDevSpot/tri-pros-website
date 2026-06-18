'use client'

import { cn } from '@/shared/lib/utils'

interface OverviewSummaryBarProps {
  dnc: number
  eligible: number
  enrolled: number
}

export function OverviewSummaryBar({ dnc, eligible, enrolled }: OverviewSummaryBarProps) {
  const segments = [
    { dotClass: 'bg-success', label: 'Enrolled', value: enrolled },
    { dotClass: 'bg-muted-foreground', label: 'Eligible', value: eligible },
    { dotClass: 'bg-destructive', label: 'DNC', value: dnc },
  ]

  return (
    <div className="flex items-center rounded-lg bg-muted/40 px-1 py-2.5 sm:px-2">
      {segments.map((seg, i) => (
        <div
          key={seg.label}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-1 sm:gap-2.5 sm:px-2',
            i > 0 && 'border-l border-border/60',
          )}
        >
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 rounded-full sm:size-2', seg.dotClass)}
          />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            {seg.label}
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {seg.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
