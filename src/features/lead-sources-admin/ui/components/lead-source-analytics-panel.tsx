'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ErrorState } from '@/shared/components/states/error-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

import { LeadSourceFunnel } from './lead-source-funnel'
import { LeadSourceTrendChart } from './lead-source-trend-chart'

interface Props {
  leadSourceId: string
  chip: TimeRangeChip
  from?: string
  to?: string
}

export function LeadSourceAnalyticsPanel({ leadSourceId, chip, from, to }: Props) {
  const trpc = useTRPC()
  const analyticsQuery = useQuery({
    ...trpc.leadSourcesRouter.getAnalytics.queryOptions({ id: leadSourceId, from, to }),
    placeholderData: keepPreviousData,
  })

  if (analyticsQuery.isError) {
    return <ErrorState title="Couldn't load analytics" description="Refresh the page or pick a different time range." />
  }

  if (!analyticsQuery.data) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="space-y-6">
      <LeadSourceFunnel funnel={analyticsQuery.data.funnel} chip={chip} />
      <LeadSourceTrendChart trend={analyticsQuery.data.trend} bucket={analyticsQuery.data.bucket} chip={chip} />
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading analytics">
      <div className="space-y-1">
        <Skeleton className="mb-3 h-4 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
      <div>
        <Skeleton className="mb-3 h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
