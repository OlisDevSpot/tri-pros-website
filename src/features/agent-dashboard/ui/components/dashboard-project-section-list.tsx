'use client'

import type { UnusedSkipTokenOptions } from '@tanstack/react-query'
import type { TRPCClientErrorLike } from '@trpc/client'
import type { inferOutput, TRPCQueryKey } from '@trpc/tanstack-react-query'
import type { useTRPC } from '@/trpc/helpers'
import type { AppRouter } from '@/trpc/routers/app'

import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardListSectionHeader } from '@/features/agent-dashboard/ui/components/dashboard-list-section-header'
import { DashboardProjectCard } from '@/features/agent-dashboard/ui/components/dashboard-project-card'
import { EntityList } from '@/shared/components/entities/entity-list/ui/entity-list'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { ProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'

type ProjectList = inferOutput<ReturnType<typeof useTRPC>['projectsRouter']['crud']['list']>
type ProjectListOptions = UnusedSkipTokenOptions<ProjectList, TRPCClientErrorLike<AppRouter>, ProjectList, TRPCQueryKey>

interface DashboardProjectSectionListProps {
  title: string
  options: ProjectListOptions
  emptyMessage: string
}

/**
 * The eyebrow label + the full-predicate total, then a capped `EntityList` of
 * `DashboardProjectCard`s. The header IS the status bucket, derived from `pipelineStage` via
 * `PROJECT_STAGE_BUCKET` (not the vestigial `status` column), so the cards carry only their
 * specific pipeline stage.
 */
export function DashboardProjectSectionList({ title, options, emptyMessage }: DashboardProjectSectionListProps) {
  useHydrationParityCheck(options.queryKey)
  const { data } = useSuspenseQuery(options)

  return (
    <section className="flex flex-col gap-2">
      <DashboardListSectionHeader title={title} total={data.total} />
      <ProjectActionsHost>
        <EntityList
          title={title}
          hideHeader
          items={data.rows}
          getItemKey={row => row.id}
          renderItem={row => <DashboardProjectCard row={row} />}
          emptyState={{ message: emptyMessage }}
          itemsClassName="space-y-2"
          variant="flush"
        />
      </ProjectActionsHost>
    </section>
  )
}
