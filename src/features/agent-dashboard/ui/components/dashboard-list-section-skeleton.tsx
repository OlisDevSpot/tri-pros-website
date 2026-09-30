import { DashboardListSectionHeader } from '@/features/agent-dashboard/ui/components/dashboard-list-section-header'
import { DashboardProjectCardSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-project-card-skeleton'
import { DashboardProposalCardSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton'

/** The section's own header over two card-shaped rows matching `card`'s real height, so the swap to the list does not jump. */
export function DashboardListSectionSkeleton({ title, card }: { title: string, card: 'proposal' | 'project' }) {
  return (
    <section className="flex flex-col gap-2" aria-busy="true">
      <DashboardListSectionHeader title={title} />
      <div className="-mx-2.5">
        {card === 'proposal'
          ? [0, 1].map(i => <DashboardProposalCardSkeleton key={i} odd={i === 1} />)
          : [0, 1].map(i => <DashboardProjectCardSkeleton key={i} odd={i === 1} />)}
      </div>
    </section>
  )
}
