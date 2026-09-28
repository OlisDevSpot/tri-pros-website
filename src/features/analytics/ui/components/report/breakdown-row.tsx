import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { readMetric } from '@/features/analytics/lib/read-metric'
import { MetricText } from '@/features/analytics/ui/components/report/metric-text'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  row: AnalyticsReportRow
  reasons: NotApplicableReasons
  columns: readonly MetricKey[]
  focus: MetricKey
  total?: boolean
}

export function BreakdownRow({ label, row, reasons, columns, focus, total = false }: Props) {
  return (
    <TableRow className={cn(total && 'bg-muted/50 font-semibold')}>
      <TableCell className={cn('sticky left-0 z-10 max-w-56 truncate', total ? 'bg-muted' : 'bg-background')}>{label}</TableCell>
      {columns.map(key => (
        <TableCell key={key} className={cn('text-right', key === focus && 'bg-accent/60')}>
          <MetricText display={readMetric(key, row, reasons)} />
        </TableCell>
      ))}
    </TableRow>
  )
}
