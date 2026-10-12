'use client'

import type { DataViewInput } from '@/shared/dal/lib/query/data-view-query-config'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProjectSectionList } from '@/features/agent-dashboard/ui/components/dashboard-project-section-list'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProjectSectionProps {
  /** Space-Mono eyebrow naming the section's status bucket. */
  title: string
  /** The static input of the config the page prefetches, so the key matches (hydration parity). */
  input: DataViewInput<typeof PROJECT_FIELDS>
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Projects module. Mirrors `DashboardProposalSection`:
 * it suspends on its own, so its rows stream into the server HTML and a failed read stays inside
 * the section.
 */
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  const trpc = useTRPC()
  const options = useLoadingScreenRead(trpc.projectsRouter.crud.list.queryOptions(input))
  const skeleton = <DashboardListSectionSkeleton title={title} card="project" />
  if (!options) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProjectSectionList title={title} options={options} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
