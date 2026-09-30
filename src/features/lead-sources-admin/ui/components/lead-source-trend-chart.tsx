'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'
import type { Bucket } from '@/features/lead-sources-admin/lib/format-bucket-label'
import type { TrendPoint } from '@/features/lead-sources-admin/types'

import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts'

import { LEAD_SOURCE_TREND_CHART_CONFIG } from '@/features/lead-sources-admin/constants/trend-chart-config'
import { formatBucketLabel } from '@/features/lead-sources-admin/lib/format-bucket-label'
import { formatTimeRangeClause } from '@/features/lead-sources-admin/lib/format-time-range-clause'
import { LeadSourceTrendTooltip } from '@/features/lead-sources-admin/ui/components/lead-source-trend-tooltip'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'
import { CHART_THROTTLED_EVENTS } from '@/shared/constants/chart-throttled-events'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'
import { formatAsCount } from '@/shared/lib/formatters'

interface Props {
  trend: TrendPoint[]
  bucket: Bucket
  chip: TimeRangeChip
}

export function LeadSourceTrendChart({ trend, bucket, chip }: Props) {
  const tooltip = usePinnedChartTooltip()
  return (
    <section aria-label="Activity over time" className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {`Activity over time · ${formatTimeRangeClause(chip)}`}
      </h3>
      <ChartContainer className="aspect-auto h-56 w-full" config={LEAD_SOURCE_TREND_CHART_CONFIG} {...tooltip.containerProps}>
        <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} throttledEvents={CHART_THROTTLED_EVENTS}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={v => formatBucketLabel(v, bucket)}
            className="text-xs"
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickFormatter={formatAsCount}
            allowDecimals={false}
            className="text-xs"
            stroke="var(--muted-foreground)"
          />
          <ChartTooltip active={tooltip.tooltipActive} content={props => <LeadSourceTrendTooltip {...props} bucket={bucket} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
          <Line type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={LEAD_SOURCE_TREND_CHART_CONFIG.leads.label} />
          <Line type="monotone" dataKey="meetings" stroke="var(--color-meetings)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={LEAD_SOURCE_TREND_CHART_CONFIG.meetings.label} />
          <Line type="monotone" dataKey="signed" stroke="var(--color-signed)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={LEAD_SOURCE_TREND_CHART_CONFIG.signed.label} />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
