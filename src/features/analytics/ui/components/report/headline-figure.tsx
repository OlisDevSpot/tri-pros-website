import type { HeadlineFigure as HeadlineFigureConfig } from '@/features/analytics/constants/tabs'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { METRICS } from '@/features/analytics/constants/metrics'
import { readMetric } from '@/features/analytics/lib/read-metric'
import { MetricText } from '@/features/analytics/ui/components/report/metric-text'
import { cn } from '@/shared/lib/utils'

interface Props {
  figure: HeadlineFigureConfig
  row: AnalyticsReportRow
  reasons: NotApplicableReasons
  selected: boolean
  onSelect: () => void
}

export function HeadlineFigure({ figure, row, reasons, selected, onSelect }: Props) {
  const main = readMetric(figure.metric, row, reasons)
  const sub = figure.sub ? readMetric(figure.sub, row, reasons) : null
  const focusable = main.kind !== 'not_yet'
  const subDefinition = figure.sub ? METRICS[figure.sub] : null
  const subShort = subDefinition && 'short' in subDefinition ? subDefinition.short : undefined
  return (
    <button
      type="button"
      disabled={!focusable}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2.5 text-left md:px-4 md:py-3.5 transition-[background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default',
        // Phone: a 3-up hairline grid, to keep the strip short.
        'max-md:border-b max-md:border-border max-md:[&:not(:nth-child(3n+1))]:border-l',
        focusable && 'hover:bg-muted',
        selected && 'shadow-[inset_0_-2px_0_var(--primary)]',
      )}
    >
      <span className={cn('text-xs text-muted-foreground', selected && 'font-semibold text-foreground')}>
        {METRICS[figure.metric].label}
      </span>
      <MetricText display={main} className="truncate font-sans text-lg leading-tight font-medium md:text-3xl" />
      {figure.sub && sub && (
        <span className="truncate text-xs text-muted-foreground">
          <span className="max-md:hidden">{METRICS[figure.sub].label}</span>
          <span className="md:hidden">{subShort ?? METRICS[figure.sub].label}</span>
          {' '}
          <MetricText display={sub} className="font-semibold text-foreground" />
        </span>
      )}
    </button>
  )
}
