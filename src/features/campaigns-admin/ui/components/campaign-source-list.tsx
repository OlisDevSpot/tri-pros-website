'use client'

import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface CampaignSourceListProps {
  selectedSlug: string | null
  onSelect: (sourceSlug: string) => void
}

/**
 * Left-rail list of lead sources with enrolled + eligible counts. Selecting a
 * source drives the enrollment panel on the right.
 */
export function CampaignSourceList({ selectedSlug, onSelect }: CampaignSourceListProps) {
  const trpc = useTRPC()
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())

  if (summariesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  const summaries = summariesQuery.data ?? []
  if (summaries.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground">No lead sources yet.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {summaries.map((summary) => {
        const isSelected = summary.sourceSlug === selectedSlug
        return (
          <li key={summary.sourceSlug}>
            <button
              type="button"
              onClick={() => onSelect(summary.sourceSlug)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-lg border border-transparent px-3 py-2.5 text-left motion-safe:transition-colors',
                isSelected
                  ? 'border-border bg-primary/5'
                  : 'hover:bg-muted/60',
              )}
            >
              <span className="truncate text-sm font-medium text-foreground">{summary.name}</span>
              <span className="flex items-center gap-1.5">
                <Badge variant="secondary" className="tabular-nums">
                  {summary.enrolledCount}
                  {' '}
                  enrolled
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  {summary.eligibleCount}
                  {' '}
                  eligible
                </Badge>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
