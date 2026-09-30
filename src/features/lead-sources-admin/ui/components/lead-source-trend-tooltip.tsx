import type { TooltipContentProps } from 'recharts'

import type { Bucket } from '@/features/lead-sources-admin/lib/format-bucket-label'
import type { TrendPoint } from '@/features/lead-sources-admin/types'

import { LEAD_SOURCE_TREND_CHART_CONFIG } from '@/features/lead-sources-admin/constants/trend-chart-config'
import { formatBucketRange } from '@/features/lead-sources-admin/lib/format-bucket-label'
import { formatAsCount } from '@/shared/lib/formatters'

type Props = TooltipContentProps & { bucket: Bucket }

export function LeadSourceTrendTooltip({ active, payload, bucket }: Props) {
  if (!active || !payload?.length) {
    return null
  }
  const point = payload[0].payload as TrendPoint
  const signedRate = point.leads > 0 ? Math.round((point.signed / point.leads) * 100) : 0
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{formatBucketRange(point.bucketStart, bucket)}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">{LEAD_SOURCE_TREND_CHART_CONFIG.leads.label}</span>
        <span className="text-right">{formatAsCount(point.leads)}</span>
        <span className="text-muted-foreground">{LEAD_SOURCE_TREND_CHART_CONFIG.meetings.label}</span>
        <span className="text-right">{formatAsCount(point.meetings)}</span>
        <span className="text-muted-foreground">{LEAD_SOURCE_TREND_CHART_CONFIG.signed.label}</span>
        <span className="text-right">{formatAsCount(point.signed)}</span>
        <span className="text-muted-foreground">Signed-rate</span>
        <span className="text-right">{`${signedRate}%`}</span>
      </div>
    </div>
  )
}
