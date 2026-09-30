import { DashboardListSectionHeader } from '@/features/agent-dashboard/ui/components/dashboard-list-section-header'
import { Skeleton } from '@/shared/components/ui/skeleton'

/** The section's own header over two dense card-shaped rows, so the swap to the list does not jump. */
export function DashboardListSectionSkeleton({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-2" aria-busy="true">
      <DashboardListSectionHeader title={title} />
      <div className="flex flex-col gap-2">
        {[0, 1].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  )
}
