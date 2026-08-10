'use client'

import type { ProjectsListInput } from '@/features/agent-dashboard/constants/dashboard-queries'

import { useQuery } from '@tanstack/react-query'

import { DashboardProjectCard } from '@/features/agent-dashboard/ui/components/dashboard-project-card'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProjectSectionProps {
  /** Space-Mono eyebrow naming the section's status bucket. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProjectsListInput
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Projects module: an eyebrow label +
 * the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProjectCard`s (or its empty state).
 * The section header IS the status bucket — derived from `pipelineStage` via
 * `PROJECT_STAGE_BUCKET`, not the vestigial `status` column — so the cards
 * carry no coarse status badge, only their specific pipeline stage. Mirrors
 * `DashboardProposalSection` so the dashboard's list modules read as one family.
 */
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.projectsRouter.crud.list.queryOptions(input))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        {data?.total !== undefined && (
          <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{data.total}</span>
        )}
      </div>
      {isLoading
        ? <DashboardProjectSectionSkeleton />
        : (
            <EntityList
              title={title}
              hideHeader
              items={data?.rows ?? []}
              getItemKey={row => row.id}
              renderItem={row => <DashboardProjectCard row={row} />}
              emptyState={{ message: emptyMessage }}
              itemsClassName="space-y-2"
              variant="flush"
            />
          )}
    </section>
  )
}

/** Two dense card-shaped rows while the section query is in flight. */
function DashboardProjectSectionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
