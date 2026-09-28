import type { MetricDisplay } from '@/features/analytics/lib/read-metric'

import { cn } from '@/shared/lib/utils'

interface Props {
  display: MetricDisplay
  className?: string
}

export function MetricText({ display, className }: Props) {
  switch (display.kind) {
    case 'value':
      return <span className={cn('tabular-nums', className)}>{display.text}</span>
    case 'empty':
      return <span className={cn('text-muted-foreground', className)} title="Nothing to divide by in this period">—</span>
    case 'not_applicable':
      return <span className={cn('text-muted-foreground', className)} title={display.reason}>n/a</span>
    case 'missing':
      return <span className={cn('text-warning', className)} title="Spend not entered for a month with leads">missing</span>
    case 'not_yet':
      // A status, never a figure: it stays quiet even where the caller sizes a headline number.
      return <span className={cn(className, 'text-sm font-normal text-muted-foreground')} title={`Arrives with ${display.source}`}>not available yet</span>
  }
}
