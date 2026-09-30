import { Skeleton } from '@/shared/components/ui/skeleton'

// Generic on purpose (every dashboard page shares the layout) and padded like
// the dashboard template, so the swap to the real page does not jump. Shows
// when the dashboard layout mounts — a document load, or a navigation in from
// outside the dashboard; navigation within the dashboard keeps the layout, so
// it does not show there.
export function DashboardGenericContentSkeleton() {
  return (
    <div
      className="flex h-full min-w-0 flex-col px-4 pb-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom))+1rem)] pt-4 md:pt-(--gutter) md:pr-(--gutter) md:pb-(--gutter) md:pl-0"
      data-slot="dashboard-content-skeleton"
      aria-busy="true"
    >
      <div className="flex flex-col gap-(--gutter)">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-(--gutter) lg:grid-cols-12">
          <Skeleton className="h-64 lg:col-span-8" />
          <div className="flex flex-col gap-(--gutter) lg:col-span-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </div>
    </div>
  )
}
