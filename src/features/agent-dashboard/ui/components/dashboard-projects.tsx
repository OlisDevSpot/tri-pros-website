'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { activeProjectsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardProjectCard } from '@/features/agent-dashboard/ui/components/dashboard-project-card'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

/**
 * Open (active) projects — `activeProjectsInput`'s `status: ['active']`
 * filter (the real "open" value among `projectStatuses`, vs `completed`/
 * `on_hold`), capped at `DASHBOARD_LIMITS.projects`. Already
 * participation-scoped server-side (Task 2: agents see projects tied to a
 * meeting they participate in, omni sees all) and shares the exact query key
 * the dashboard route prefetches server-side (Task 4:
 * `trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput())`), so
 * this mount hydrates instantly instead of refiring the query.
 */
export function DashboardProjects() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Open projects</h2>
        <Link
          href={ROOTS.dashboard.projects.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      </div>

      {isLoading
        ? <DashboardProjectsSkeleton />
        : (
            <EntityList
              title="Projects"
              items={data?.rows ?? []}
              getItemKey={row => row.id}
              renderItem={row => <DashboardProjectCard row={row} />}
              emptyState={{ message: 'No open projects' }}
              itemsClassName="space-y-2"
              variant="flush"
            />
          )}
    </div>
  )
}

/** `DASHBOARD_LIMITS.projects`-capped roster; 2 dense card-shaped rows while loading. */
function DashboardProjectsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
