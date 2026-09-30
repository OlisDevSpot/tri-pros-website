import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'

import { SERIES_COLORS } from '@/features/analytics/constants/chart-series'
import { METRICS } from '@/features/analytics/constants/metrics'
import { cn } from '@/shared/lib/utils'

interface Props {
  series: readonly ChartSeriesKey[]
  active: readonly ChartSeriesKey[]
  onToggle: (key: ChartSeriesKey) => void
}

/** The chart's legend doubles as its filter; the last series left on cannot be turned off. */
export function SeriesToggle({ series, active, onToggle }: Props) {
  return (
    <div role="group" aria-label="Series shown" className="flex flex-wrap gap-1.5">
      {series.map((key) => {
        const on = active.includes(key)
        const last = on && active.length === 1
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            aria-disabled={last || undefined}
            title={last ? 'At least one series stays on' : undefined}
            onClick={() => onToggle(key)}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-border-strong bg-card text-foreground' : 'border-dashed border-border text-muted-foreground hover:text-foreground',
              last && 'cursor-default',
            )}
          >
            <i aria-hidden className={cn('size-2.5 rounded-xs', SERIES_COLORS[key].swatch, !on && 'opacity-35')} />
            {METRICS[key].label}
          </button>
        )
      })}
    </div>
  )
}
