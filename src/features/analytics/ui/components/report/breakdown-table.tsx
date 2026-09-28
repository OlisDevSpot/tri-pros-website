'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'
import type { AnalyticsGroupBy, AnalyticsReport } from '@/features/analytics/types'

import { GROUP_BY_LABELS } from '@/features/analytics/constants/labels'
import { METRICS } from '@/features/analytics/constants/metrics'
import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { breakdownColumns } from '@/features/analytics/lib/breakdown-columns'
import { groupLabel } from '@/features/analytics/lib/format-analytics'
import { sortRowsByMetric } from '@/features/analytics/lib/read-metric'
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
  const columns = breakdownColumns(config)
  const rows = sortRowsByMetric(report.breakdown, focus, report.notApplicable.breakdown)
  return (
    <section aria-labelledby="breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="breakdown" className="text-lg font-medium">Breakdown</h2>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
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
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">{GROUP_BY_LABELS[groupBy]}</TableHead>
              {columns.map(key => (
                <TableHead key={key} className={cn('text-right whitespace-nowrap', key === focus && 'text-primary')}>{METRICS[key].label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <BreakdownRow label="Total" row={report.headline} reasons={report.notApplicable.headline} columns={columns} focus={focus} total />
            {rows.map(row => (
              <BreakdownRow key={row.groupKey ?? 'none'} label={groupLabel(groupBy, row.groupKey, labels)} row={row} reasons={report.notApplicable.breakdown} columns={columns} focus={focus} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">No activity in this period.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
