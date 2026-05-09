'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ErrorState } from '@/shared/components/states/error-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

import { AnalyticsContent } from './analytics-content'

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
    return (
      <ErrorState
        title="Couldn't load analytics"
        description="Please try refreshing or selecting a different time range."
      />
    )
  }

  if (!analyticsQuery.data) {
    return <AnalyticsSkeleton />
  }

  return (
    <AnalyticsContent
      funnel={analyticsQuery.data.funnel}
      trend={analyticsQuery.data.trend}
      bucket={analyticsQuery.data.bucket}
      chip={chip}
    />
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading analytics">
      <div className="space-y-1.5">
        <Skeleton className="mb-2 h-3 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="grid grid-cols-[6rem_1fr_3rem_3rem] items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
      <div>
        <Skeleton className="mb-2 h-3 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  )
}
