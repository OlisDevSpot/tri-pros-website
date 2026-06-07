'use client'

import { useQuery } from '@tanstack/react-query'

import { OverviewTotalsStrip } from '@/features/campaigns-admin/ui/components/overview/overview-totals-strip'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions(),
  )
  const summaries = data ?? []

  const totals = summaries.reduce(
    (acc, s) => ({
      dnc: acc.dnc + s.dncCount,
      eligible: acc.eligible + s.eligibleCount,
      enrolled: acc.enrolled + s.enrolledCount,
    }),
    { dnc: 0, eligible: 0, enrolled: 0 },
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 overflow-y-auto">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="h-44 w-full"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <OverviewTotalsStrip
        dnc={totals.dnc}
        eligible={totals.eligible}
        enrolled={totals.enrolled}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map(s => (
          <SourceRollupCard
            key={s.sourceSlug}
            summary={s}
          />
        ))}
      </div>
    </div>
  )
}
