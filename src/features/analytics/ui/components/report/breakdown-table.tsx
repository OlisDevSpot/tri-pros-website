'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'
import type { AnalyticsGroupBy, AnalyticsReport } from '@/features/analytics/types'

import { GROUP_BY_LABELS } from '@/features/analytics/constants/labels'
import { METRICS } from '@/features/analytics/constants/metrics'
import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { breakdownColumns } from '@/features/analytics/lib/breakdown-columns'
import { groupLabel } from '@/features/analytics/lib/format-analytics'
import { readMetric, sortRowsByMetric } from '@/features/analytics/lib/read-metric'
import { rowFilter } from '@/features/analytics/lib/row-filter'
import { BreakdownRow } from '@/features/analytics/ui/components/report/breakdown-row'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface Props {
  config: ReportTabConfig
  report: AnalyticsReport
  focus: MetricKey
  groupBy: Exclude<AnalyticsGroupBy, 'total'>
  onGroupBy: (groupBy: Exclude<AnalyticsGroupBy, 'total'>) => void
}

export function BreakdownTable({ config, report, focus, groupBy, onGroupBy }: Props) {
  const labels = useAnalyticsLabels()
  const [state, setUrlState] = useAnalyticsUrlState()
  const columns = breakdownColumns(config)
  const rows = sortRowsByMetric(report.breakdown, focus, report.notApplicable.breakdown)
  const shown = [
    { row: report.headline, reasons: report.notApplicable.headline },
    ...rows.map(row => ({ row, reasons: report.notApplicable.breakdown })),
  ]
  // Printed, not only in each cell's title, so the reason reaches touch and screen-reader users.
  const notApplicable = [...new Set(shown.flatMap(({ row, reasons }) => columns.map(key => readMetric(key, row, reasons))).flatMap(d => (d.kind === 'not_applicable' ? [d.reason] : [])))]
  return (
    <section aria-labelledby="breakdown" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="breakdown" className="text-base font-medium">Breakdown</h2>
          <p className="text-xs text-muted-foreground">
            Sorted by
            {' '}
            {METRICS[focus].label.toLowerCase()}
            {' · click a row to filter to it'}
          </p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="segmented"
          value={groupBy}
          aria-label="Group by"
          onValueChange={(value) => {
            const next = config.groupBys.find(g => g === value)
            if (next) {
              onGroupBy(next)
            }
          }}
        >
          {config.groupBys.map(g => <ToggleGroupItem key={g} value={g}>{GROUP_BY_LABELS[g]}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      {report.breakdown.some(r => r.overlapsTotal) && (
        <p className="text-xs text-muted-foreground">A meeting counts for each closer on it, so closer rows add up to more than the total.</p>
      )}
      <div className="-mx-4 overflow-x-auto border-y border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-(--card) text-xs font-semibold text-muted-foreground">{GROUP_BY_LABELS[report.groupBy]}</TableHead>
              {columns.map(key => (
                <TableHead
                  key={key}
                  aria-sort={key === focus ? 'descending' : undefined}
                  className={cn('text-right text-xs font-semibold whitespace-nowrap text-muted-foreground', key === focus && 'bg-primary/8 text-primary')}
                >
                  {METRICS[key].label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <BreakdownRow label="Total" row={report.headline} reasons={report.notApplicable.headline} columns={columns} focus={focus} total />
            {rows.map((row, index) => (
              <BreakdownRow
                key={row.groupKey ?? 'none'}
                label={groupLabel(report.groupBy, row.groupKey, labels)}
                row={row}
                reasons={report.notApplicable.breakdown}
                columns={columns}
                focus={focus}
                odd={index % 2 === 1}
                filter={rowFilter(report.groupBy, row.groupKey, state)}
                // Pushed, so the browser's Back undoes a click-filter.
                onFilter={filter => void setUrlState(filter.update, { history: 'push' })}
              />
            ))}
            {rows.length === 0 && (
              <TableRow className="border-b-0">
                <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">No activity in this period.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {notApplicable.map(reason => (
        <p key={reason} className="text-xs text-muted-foreground">
          n/a:
          {' '}
          {reason}
        </p>
      ))}
    </section>
  )
}
