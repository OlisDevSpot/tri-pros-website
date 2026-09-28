'use client'

import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'
import type { ReportTab } from '@/features/analytics/constants/tabs'
import type { AnalyticsReport } from '@/features/analytics/types'

import { SERIES_COLOR_VARS } from '@/features/analytics/constants/chart-series'
import { ANALYTICS_INTERVALS } from '@/features/analytics/constants/dimensions'
import { INTERVAL_LABELS } from '@/features/analytics/constants/labels'
import { METRICS } from '@/features/analytics/constants/metrics'
import { REPORT_TABS } from '@/features/analytics/constants/tabs'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { buildChartRows } from '@/features/analytics/lib/chart-rows'
import { resolveSeries } from '@/features/analytics/lib/to-report-input'
import { SeriesToggle } from '@/features/analytics/ui/components/report/series-toggle'
import { TrendPlot } from '@/features/analytics/ui/components/report/trend-plot'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface Props {
  tab: ReportTab
  report: AnalyticsReport
}

function isMoney(key: ChartSeriesKey): boolean {
  return METRICS[key].format === 'money'
}

export function TrendChart({ tab, report }: Props) {
  const [state, setUrlState] = useAnalyticsUrlState()
  const { chart } = REPORT_TABS[tab]
  const active = resolveSeries(tab, state.series)
  const rows = buildChartRows(report, active)
  const { interval, intervals } = report.chart
  const counts = active.filter(key => !isMoney(key))
  const money = active.filter(isMoney)

  const toggle = (key: ChartSeriesKey) => {
    const next = active.includes(key) ? active.filter(k => k !== key) : chart.series.filter(k => k === key || active.includes(k))
    if (next.length > 0) {
      void setUrlState({ series: next })
    }
  }

  return (
    <section aria-labelledby="trend-heading" className={cn('flex min-w-0 flex-col gap-3', SERIES_COLOR_VARS)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          {/* The step control and the tick labels already say day, week or month. */}
          <h2 id="trend-heading" className="sr-only">
            By
            {' '}
            {INTERVAL_LABELS[interval].toLowerCase()}
          </h2>
          {intervals.length > 1 && (
            <ToggleGroup
              type="single"
              size="sm"
              variant="segmented"
              value={interval}
              aria-label="Chart step"
              onValueChange={(value) => {
                const next = ANALYTICS_INTERVALS.find(i => i === value)
                if (next) {
                  void setUrlState({ interval: next })
                }
              }}
            >
              {intervals.map(i => <ToggleGroupItem key={i} value={i} className="h-7">{INTERVAL_LABELS[i]}</ToggleGroupItem>)}
            </ToggleGroup>
          )}
          {rows.length > 1 && <p className="text-xs text-muted-foreground max-lg:hidden">Double-click a bar to zoom in</p>}
        </div>
        <SeriesToggle series={chart.series} active={active} onToggle={toggle} />
      </div>
      <TrendPlot
        rows={rows}
        interval={interval}
        // Zooms the page into the clicked bucket; pushed, so Back returns to the wider view.
        onBucket={rows.length > 1 ? row => void setUrlState({ period: 'custom', from: row.key, to: row.last, interval: null }, { history: 'push' }) : undefined}
        panels={[
          ...(counts.length > 0 ? [{ series: counts, format: 'count' as const, height: 224 }] : []),
          ...(money.length > 0 ? [{ series: money, format: 'money' as const, height: counts.length > 0 ? 128 : 224 }] : []),
        ]}
      />
    </section>
  )
}
