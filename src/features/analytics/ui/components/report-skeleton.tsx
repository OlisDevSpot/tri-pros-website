import { Skeleton } from '@/shared/components/ui/skeleton'

export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
