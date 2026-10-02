import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { RowFilter } from '@/features/analytics/lib/row-filter'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { FilterIcon, XIcon } from 'lucide-react'

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
  /** Odd data rows take the band. */
  odd?: boolean
  /** Present when a click on the row can narrow the page to it. */
  filter?: RowFilter | null
  onFilter?: (filter: RowFilter) => void
}

export function BreakdownRow({ label, row, reasons, columns, focus, total = false, odd, filter, onFilter }: Props) {
  const apply = filter && onFilter ? () => onFilter(filter) : undefined
  return (
    <TableRow
      data-state={filter?.active ? 'selected' : undefined}
      onClick={apply}
      className={cn('group/row border-b-0', odd && !total && 'bg-band', total && 'bg-muted font-semibold hover:bg-muted', apply && 'cursor-pointer')}
    >
      <TableCell className={cn('sticky left-0 z-10 max-w-36 md:max-w-56', total ? 'bg-muted' : cn(odd ? 'bg-band' : 'bg-(--card)', 'group-hover/row:bg-row-hover group-data-[state=selected]/row:bg-row-selected'))}>
        {apply
          ? (
              // The row takes the mouse click; this button is the keyboard and screen-reader way in.
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  apply()
                }}
                aria-label={filter?.active ? `Remove the ${label} filter` : `Filter to ${label}`}
                aria-pressed={filter?.active}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{label}</span>
                {filter?.active
                  ? <XIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  : <FilterIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100" aria-hidden="true" />}
              </button>
            )
          : <span className="block truncate">{label}</span>}
      </TableCell>
      {columns.map(key => (
        <TableCell key={key} className={cn('text-right', key === focus && 'bg-primary/8')}>
          <MetricText display={readMetric(key, row, reasons)} />
        </TableCell>
      ))}
    </TableRow>
  )
}
