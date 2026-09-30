import { Skeleton } from '@/shared/components/ui/skeleton'

export function ScheduleCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 rounded-md border bg-card p-3 pl-3.5 shadow-sm">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}
