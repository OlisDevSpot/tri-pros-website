'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { awaitingProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardProposalCard } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

/**
 * Proposals awaiting the homeowner's signature — contract sent, not yet
 * signed or declined (`awaitingProposalsInput`'s `awaitingSignature` filter,
 * capped at `DASHBOARD_LIMITS.proposals`). Uses the exact same query key the
 * dashboard route already prefetches server-side (Task 4:
 * `trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput())`),
 * so this mount hydrates instantly instead of refiring the query.
 */
export function DashboardProposals() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Awaiting signature</h2>
        <Link
          href={ROOTS.dashboard.proposals.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      </div>

      {isLoading
        ? <DashboardProposalsSkeleton />
        : (
            <EntityList
              title="Proposals"
              hideHeader
              items={data?.rows ?? []}
              getItemKey={row => row.id}
              renderItem={row => <DashboardProposalCard row={row} />}
              emptyState={{ message: 'No proposals awaiting signature' }}
              itemsClassName="space-y-2"
              variant="flush"
            />
          )}
    </div>
  )
}

/** `DASHBOARD_LIMITS.proposals`-capped roster; 3 dense card-shaped rows while loading. */
function DashboardProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
