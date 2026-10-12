'use client'

import { Suspense } from 'react'

import { awaitingProposalsInput, DASHBOARD_ACTIVE_PROJECTS_QUERY, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { DashboardSnapshotCounts } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-counts'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { useTRPC } from '@/trpc/helpers'

/**
 * The chips are jump-links first, so they render while the counts load and stay when a count
 * read fails; the modules below own the loud error state and its retry.
 */
export function DashboardSnapshotStrip() {
  const trpc = useTRPC()
  const meetingsToday = useLoadingScreenRead(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
  const awaitingSignature = useLoadingScreenRead(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
  const activeProjects = useLoadingScreenRead(trpc.projectsRouter.crud.list.queryOptions(staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)))
  if (!meetingsToday || !awaitingSignature || !activeProjects) {
    return <DashboardSnapshotChips />
  }
  return (
    <HydrationErrorBoundary fallback={<DashboardSnapshotChips />}>
      <Suspense fallback={<DashboardSnapshotChips />}>
        <DashboardSnapshotCounts meetingsToday={meetingsToday} awaitingSignature={awaitingSignature} activeProjects={activeProjects} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
