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
  return (
    <button
      type="button"
      disabled={!focusable}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left transition-colors disabled:cursor-default',
        focusable && 'hover:bg-muted/60',
        selected && 'bg-accent shadow-[inset_0_-2px_0_var(--primary)]',
      )}
    >
      <span className={cn('text-xs font-bold uppercase tracking-wider text-muted-foreground', selected && 'text-primary')}>
        {METRICS[figure.metric].label}
      </span>
      <MetricText display={main} className="text-2xl font-semibold" />
      {figure.sub && sub && (
        <span className="text-xs text-muted-foreground">
          {METRICS[figure.sub].label}
          {' '}
          <MetricText display={sub} />
        </span>
      )}
    </button>
  )
}
