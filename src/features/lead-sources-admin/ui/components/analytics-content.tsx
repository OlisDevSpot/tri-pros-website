'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'
import type { FunnelCounts } from '@/features/lead-sources-admin/lib/compute-funnel-rates'
import type { Bucket } from '@/features/lead-sources-admin/lib/format-bucket-label'

import { EmptyState } from '@/shared/components/states/empty-state'

import { LeadSourceFunnel } from './lead-source-funnel'
import { LeadSourceTrendChart } from './lead-source-trend-chart'

interface TrendPoint {
  bucketStart: string
  leads: number
  meetings: number
  signed: number
}

interface Props {
  funnel: FunnelCounts
  trend: TrendPoint[]
  bucket: Bucket
  chip: TimeRangeChip
}

/**
 * Pure render of the analytics tab body — funnel + trend chart with one
 * lifted empty state when there's no activity in range. Both the per-source
 * and the aggregate "All" panels render through this so they stay aligned.
 */
export function AnalyticsContent({ funnel, trend, bucket, chip }: Props) {
  if (funnel.leads === 0) {
    return (
      <EmptyState
        className="h-auto py-6"
        title="No leads in this range"
        description="Try a longer time range, or check the Customers tab."
      />
    )
  }

  return (
    <div className="space-y-6">
      <LeadSourceFunnel funnel={funnel} chip={chip} />
      <LeadSourceTrendChart trend={trend} bucket={bucket} chip={chip} />
    </div>
  )
}
