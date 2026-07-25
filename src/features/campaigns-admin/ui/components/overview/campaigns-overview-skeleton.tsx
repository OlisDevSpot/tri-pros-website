import { Skeleton } from '@/shared/components/ui/skeleton'

export function CampaignsOverviewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-1" aria-label="Loading campaigns overview">
      <Skeleton className="h-12 w-full" />
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
