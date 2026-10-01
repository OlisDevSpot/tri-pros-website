'use client'

import type { ProjectsListInput } from '@/features/agent-dashboard/constants/dashboard-queries'

import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardListSectionHeader } from '@/features/agent-dashboard/ui/components/dashboard-list-section-header'
import { DashboardProjectCard } from '@/features/agent-dashboard/ui/components/dashboard-project-card'
import { EntityList } from '@/shared/components/entities/entity-list/ui/entity-list'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProjectSectionListProps {
  title: string
  input: ProjectsListInput
  emptyMessage: string
}

/**
 * The eyebrow label + the full-predicate total, then a capped `EntityList` of
 * `DashboardProjectCard`s. The header IS the status bucket, derived from `pipelineStage` via
 * `PROJECT_STAGE_BUCKET` (not the vestigial `status` column), so the cards carry only their
 * specific pipeline stage.
 */
export function DashboardProjectSectionList({ title, input, emptyMessage }: DashboardProjectSectionListProps) {
  const trpc = useTRPC()
  const options = trpc.projectsRouter.crud.list.queryOptions(input)
  useHydrationParityCheck(options.queryKey)
  const { data } = useSuspenseQuery(options)

  return (
    <section className="flex flex-col gap-2">
      <DashboardListSectionHeader title={title} total={data.total} />
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
    </section>
  )
}
